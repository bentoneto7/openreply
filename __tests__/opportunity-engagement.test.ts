import { describe, expect, it } from "vitest";
import {
  buildEngagementIndex,
  decodeEngagementCursor,
  encodeEngagementCursor,
  engagementKey,
  engagementWindowStart,
  isAfterEngagementCursor,
  rankByEngagement,
  type OpportunityEngagement,
} from "@/lib/crm/opportunity-engagement";
import type { HeatmapLog } from "@/lib/heatmap/priority";

const now = new Date("2026-09-04T12:00:00.000Z");

function log(overrides: Partial<HeatmapLog> & Pick<HeatmapLog, "commenterId" | "commentId">): HeatmapLog {
  return {
    id: `log_${overrides.commentId}`,
    instagramAccountId: "account_1",
    commenterName: null,
    commentText: "",
    matchedKeyword: null,
    status: "SENT",
    createdAt: now,
    automation: { name: "Oferta" },
    instagramAccount: { username: "brand" },
    ...overrides,
  };
}

function lead(id: string, commenterId: string, instagramAccountId = "account_1") {
  return { id, commenterId, instagramAccount: { id: instagramAccountId } };
}

describe("engagement window", () => {
  it("cobre exatamente os últimos 7 dias", () => {
    expect(engagementWindowStart(now).toISOString()).toBe("2026-08-28T12:00:00.000Z");
  });
});

describe("buildEngagementIndex", () => {
  it("indexa pela mesma chave (conta, pessoa) do mapa de calor", () => {
    const index = buildEngagementIndex([log({ commenterId: "person_1", commentId: "c1" })], now);
    expect([...index.keys()]).toEqual([engagementKey("account_1", "person_1")]);
  });

  it("pontua intenção comercial acima de presença social", () => {
    const index = buildEngagementIndex(
      [
        log({ commenterId: "comprador", commentId: "c1", matchedKeyword: "preço" }),
        log({ commenterId: "comprador", commentId: "dm:1" }),
        log({ commenterId: "curioso", commentId: "c2" }),
      ],
      now
    );

    const comprador = index.get(engagementKey("account_1", "comprador"));
    const curioso = index.get(engagementKey("account_1", "curioso"));
    expect(comprador!.score).toBeGreaterThan(curioso!.score);
    expect(comprador!.reasons.join(" ")).toContain("palavra-chave");
  });
});

describe("rankByEngagement", () => {
  it("ordena do mais engajado para o menos engajado", () => {
    const index = buildEngagementIndex(
      [
        log({ commenterId: "frio", commentId: "c1" }),
        log({ commenterId: "quente", commentId: "c2", matchedKeyword: "quero comprar" }),
        log({ commenterId: "quente", commentId: "dm:2" }),
        log({ commenterId: "morno", commentId: "c3", matchedKeyword: "link" }),
      ],
      now
    );

    const ranked = rankByEngagement(
      [lead("lead_frio", "frio"), lead("lead_quente", "quente"), lead("lead_morno", "morno")],
      index
    );

    expect(ranked.map((item) => item.row.id)).toEqual(["lead_quente", "lead_morno", "lead_frio"]);
    expect(ranked[0].engagement.score).toBeGreaterThan(ranked[2].engagement.score);
  });

  it("deixa fora quem não teve sinal no período em vez de dar score zero", () => {
    const index = buildEngagementIndex([log({ commenterId: "ativo", commentId: "c1" })], now);
    const ranked = rankByEngagement([lead("lead_ativo", "ativo"), lead("lead_parado", "parado")], index);

    expect(ranked.map((item) => item.row.id)).toEqual(["lead_ativo"]);
    expect(ranked.some((item) => item.engagement.score === 0)).toBe(false);
  });

  it("não cruza o score de uma conta com o lead de outra conta", () => {
    const index = buildEngagementIndex([log({ commenterId: "person_1", commentId: "c1" })], now);
    const ranked = rankByEngagement([lead("lead_outra_conta", "person_1", "account_2")], index);

    expect(ranked).toEqual([]);
  });

  it("desempata por sinal mais recente e depois por id, sempre na mesma ordem", () => {
    const index = new Map<string, OpportunityEngagement>([
      [engagementKey("account_1", "a"), rank(50, "2026-09-04T10:00:00.000Z")],
      [engagementKey("account_1", "b"), rank(50, "2026-09-04T11:00:00.000Z")],
      [engagementKey("account_1", "c"), rank(50, "2026-09-04T11:00:00.000Z")],
    ]);

    const ranked = rankByEngagement(
      [lead("lead_a", "a"), lead("lead_b", "b"), lead("lead_c", "c")],
      index
    );

    expect(ranked.map((item) => item.row.id)).toEqual(["lead_c", "lead_b", "lead_a"]);
  });
});

function rank(score: number, lastSeenAt: string): OpportunityEngagement {
  return { score, temperature: "QUENTE", signalCount: 1, lastSeenAt, reasons: [] };
}

describe("engagement cursor", () => {
  it("sobrevive a uma ida e volta", () => {
    const cursor = { score: 42, lastSeenAt: "2026-09-04T10:00:00.000Z", id: "lead_1" };
    expect(decodeEngagementCursor(encodeEngagementCursor(cursor))).toEqual(cursor);
  });

  it("recusa lixo e o cursor da outra ordenação", () => {
    expect(decodeEngagementCursor("nao-e-base64url!!")).toBeNull();
    const recentCursor = Buffer.from(
      JSON.stringify({ updatedAt: "2026-09-04T10:00:00.000Z", id: "lead_1" }),
      "utf8"
    ).toString("base64url");
    expect(decodeEngagementCursor(recentCursor)).toBeNull();
  });

  it("continua a fila sem repetir nem pular a linha do cursor", () => {
    const index = new Map<string, OpportunityEngagement>([
      [engagementKey("account_1", "a"), rank(80, "2026-09-04T11:00:00.000Z")],
      [engagementKey("account_1", "b"), rank(50, "2026-09-04T11:00:00.000Z")],
      [engagementKey("account_1", "c"), rank(50, "2026-09-04T10:00:00.000Z")],
    ]);
    const ranked = rankByEngagement(
      [lead("lead_a", "a"), lead("lead_b", "b"), lead("lead_c", "c")],
      index
    );

    const cursor = {
      score: ranked[0].engagement.score,
      lastSeenAt: ranked[0].engagement.lastSeenAt,
      id: ranked[0].row.id,
    };
    const rest = ranked.filter((item) => isAfterEngagementCursor(item, cursor));

    expect(rest.map((item) => item.row.id)).toEqual(["lead_b", "lead_c"]);
  });
});
