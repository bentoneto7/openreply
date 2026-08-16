import { describe, expect, it } from "vitest";
import type { InstagramConversation } from "@/lib/meta/client";
import {
  buildDmQueue,
  selectInboundThreads,
  DmQueueAccountIdentityError,
} from "@/lib/leads/dm-queue";

const now = new Date("2026-08-15T15:00:00.000Z");
const ME = "17841400000000000"; // user_id profissional da conta conectada

function conversation(
  id: string,
  fromId: string,
  createdTime: string,
  message = "oi",
  username = "pessoa"
): InstagramConversation {
  return {
    id,
    updated_time: createdTime,
    participants: { data: [{ id: ME, username: "benttoneto" }, { id: fromId, username }] },
    messages: { data: [{ id: `m_${id}`, from: { id: fromId, username }, created_time: createdTime, message }] },
  };
}

/** Horas atrás, em ISO. */
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("selectInboundThreads", () => {
  it("keeps only threads whose last message came from the other person", () => {
    const inbound = selectInboundThreads(
      [
        conversation("c1", "lead-a", ago(1)),
        conversation("c2", ME, ago(2)), // já respondida por nós
        conversation("c3", "lead-b", ago(3)),
      ],
      ME
    );
    expect(inbound.map((t) => t.conversationId)).toEqual(["c1", "c3"]);
    expect(inbound[0].commenterId).toBe("lead-a");
  });

  it("throws instead of inverting the queue when the stored id is not the account", () => {
    // O cenário real: `instagramId` gravado com o `id` app-scoped em vez do
    // `user_id`. Sem o guard, TODA mensagem seria lida como recebida.
    const threads = [conversation("c1", "lead-a", ago(1)), conversation("c2", ME, ago(2))];
    expect(() => selectInboundThreads(threads, "app-scoped-id")).toThrow(DmQueueAccountIdentityError);
    expect(() => selectInboundThreads(threads, "app-scoped-id")).toThrow(/Reconecte a conta/);
    // E com o ID certo o mesmo conjunto passa e devolve só a de fora.
    expect(selectInboundThreads(threads, ME)).toHaveLength(1);
  });

  it("accepts an account identified only by having sent the last message", () => {
    // participants sem o nosso id, mas somos o autor da última mensagem de c2.
    const bare: InstagramConversation[] = [
      { ...conversation("c1", "lead-a", ago(1)), participants: { data: [{ id: "lead-a" }] } },
      { ...conversation("c2", ME, ago(2)), participants: { data: [{ id: "lead-b" }] } },
    ];
    expect(selectInboundThreads(bare, ME).map((t) => t.conversationId)).toEqual(["c1"]);
  });

  it("skips threads with no message or no identifiable author", () => {
    const threads: InstagramConversation[] = [
      conversation("c1", "lead-a", ago(1)),
      { id: "c2", participants: { data: [{ id: ME }, { id: "lead-b" }] } },
      { id: "c3", participants: { data: [{ id: ME }, { id: "lead-c" }] }, messages: { data: [{ id: "m", message: "oi" }] } },
    ];
    expect(selectInboundThreads(threads, ME).map((t) => t.conversationId)).toEqual(["c1"]);
  });

  it("returns an empty queue for an account with no conversations at all", () => {
    expect(selectInboundThreads([], ME)).toEqual([]);
  });
});

describe("buildDmQueue", () => {
  const build = (threads: InstagramConversation[], extra: Parameters<typeof buildDmQueue>[1] = { instagramAccountId: "acc" }) =>
    buildDmQueue(selectInboundThreads(threads, ME), { now, ...extra });

  it("ranks by hours left in the 24h window, soonest to close first", () => {
    const queue = build([
      conversation("c-fresh", "lead-fresh", ago(1)), // 23h restantes
      conversation("c-tight", "lead-tight", ago(23)), // 1h restante
      conversation("c-mid", "lead-mid", ago(19)), // 5h restantes
    ]);
    expect(queue.map((item) => item.commenterId)).toEqual(["lead-tight", "lead-mid", "lead-fresh"]);
    expect(queue.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(queue[0].hoursLeftInWindow).toBeCloseTo(1);
    expect(queue.every((item) => item.windowOpen)).toBe(true);
  });

  it("uses the product temperature vocabulary, hottest at the top of the window", () => {
    const [urgent] = build([conversation("c1", "lead", ago(23))]);
    const [calm] = build([conversation("c2", "lead", ago(1))]);
    expect(urgent.temperature).toBe("PRIORIDADE");
    expect(calm.temperature).toBe("ENGAJADO");
  });

  it("pushes closed windows to the bottom, most recently closed first", () => {
    const queue = build([
      conversation("c-open", "lead-open", ago(20)),
      conversation("c-old", "lead-old", ago(72)),
      conversation("c-just", "lead-just", ago(25)),
    ]);
    expect(queue.map((item) => item.commenterId)).toEqual(["lead-open", "lead-just", "lead-old"]);
    expect(queue[1].windowOpen).toBe(false);
    expect(queue[1].hoursLeftInWindow).toBeCloseTo(-1);
    expect(queue[1].reasons).toContain("janela de 24h da Meta fechou há 1h");
  });

  it("lifts a follower over a non-follower inside the same urgency band", () => {
    const queue = build(
      [conversation("c1", "nao-segue", ago(20)), conversation("c2", "segue", ago(19))],
      { instagramAccountId: "acc", followStatus: { segue: true, "nao-segue": false } }
    );
    // "nao-segue" fecha antes, mas ambos caem na mesma faixa e o follow decide.
    expect(queue.map((item) => item.commenterId)).toEqual(["segue", "nao-segue"]);
    expect(queue[0].reasons).toContain("segue a conta no Instagram");
    expect(queue[1].reasons).toContain("não segue a conta no Instagram");
  });

  it("never outranks the urgency band with the lifts", () => {
    const queue = build(
      [conversation("c1", "sem-nada", ago(23)), conversation("c2", "com-tudo", ago(1), "quanto custa o link?")],
      { instagramAccountId: "acc", keywords: ["link"], followStatus: { "com-tudo": true } }
    );
    expect(queue.map((item) => item.commenterId)).toEqual(["sem-nada", "com-tudo"]);
    expect(queue[1].matchedKeyword).toBe("link");
  });

  it("omits the follow signal when Meta did not answer, instead of calling it false", () => {
    const [item] = build([conversation("c1", "lead", ago(2))], {
      instagramAccountId: "acc",
      followStatus: { lead: null },
    });
    expect(item.followsAccount).toBeNull();
    expect(item.reasons.join(" ")).not.toMatch(/segue a conta/);
  });

  it("labels a DM as a DM and never claims a comment or intent", () => {
    const [item] = build([conversation("c1", "lead", ago(2), "quanto custa?")], {
      instagramAccountId: "acc",
      keywords: ["quanto"],
    });
    expect(item.reasons[0]).toBe("a última mensagem é da pessoa e segue sem resposta");
    expect(item.reasons).toContain('a DM cita a palavra-chave "quanto"');
    expect(item.reasons.join(" ")).not.toMatch(/coment[áa]rio|inten[çc][ãa]o/i);
  });

  it("keys each entry the same way the heatmap does, so the CRM lead joins", () => {
    const [item] = build([conversation("c1", "igsid-42", ago(2))]);
    expect(item.key).toBe("acc:igsid-42");
    expect(item.commenterId).toBe("igsid-42");
    expect(item.commenterName).toBe("pessoa");
  });

  it("is deterministic: equal scores break on a stable key", () => {
    const sameInstant = ago(5);
    const threads = [
      conversation("c-b", "lead-b", sameInstant),
      conversation("c-a", "lead-a", sameInstant),
      conversation("c-c", "lead-c", sameInstant),
    ];
    const first = build(threads).map((item) => item.conversationId);
    const second = build([...threads].reverse()).map((item) => item.conversationId);
    expect(first).toEqual(["c-a", "c-b", "c-c"]);
    expect(second).toEqual(first);
  });

  it("ranks a thread with no timestamp last instead of pretending the window is open", () => {
    const undated: InstagramConversation = {
      id: "c-undated",
      participants: { data: [{ id: ME }, { id: "lead-x" }] },
      messages: { data: [{ id: "m", from: { id: "lead-x" }, message: "oi" }] },
    };
    const queue = build([undated, conversation("c1", "lead-y", ago(23))]);
    expect(queue.map((item) => item.commenterId)).toEqual(["lead-y", "lead-x"]);
    expect(queue[1].hoursLeftInWindow).toBeNull();
    expect(queue[1].lastInboundAt).toBeNull();
    expect(queue[1].reasons.join(" ")).not.toMatch(/janela/);
  });
});
