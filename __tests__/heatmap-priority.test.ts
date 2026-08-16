import { describe, expect, it } from "vitest";
import { buildHeatmapQueue, countByTemperature, periodStart, temperatureForScore } from "@/lib/heatmap/priority";

const now = new Date("2026-08-15T15:00:00.000Z");

describe("heatmap priority", () => {
  it("uses exact UTC windows", () => {
    expect(periodStart("24h", now).toISOString()).toBe("2026-08-14T15:00:00.000Z");
    expect(periodStart("7d", now).toISOString()).toBe("2026-08-08T15:00:00.000Z");
    expect(periodStart("30d", now).toISOString()).toBe("2026-07-16T15:00:00.000Z");
    expect(periodStart("90d", now).toISOString()).toBe("2026-05-17T15:00:00.000Z");
  });

  it("groups people by workspace-safe account identity and explains ordering", () => {
    const queue = buildHeatmapQueue([
      { id: "1", instagramAccountId: "account-a", commenterId: "person", commenterName: "Ana", commentId: "c1", commentText: "preço", matchedKeyword: "PREÇO", status: "SENT", createdAt: new Date("2026-08-15T14:00:00Z"), automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
      { id: "2", instagramAccountId: "account-a", commenterId: "person", commenterName: "Ana", commentId: "c2", commentText: "quero", matchedKeyword: "QUERO", status: "SENT", createdAt: new Date("2026-08-15T13:00:00Z"), automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
      { id: "3", instagramAccountId: "account-b", commenterId: "person", commenterName: "Ana 2", commentId: "c3", commentText: "oi", matchedKeyword: null, status: "FAILED", createdAt: new Date("2026-08-15T14:30:00Z"), automation: { name: "Geral" }, instagramAccount: { username: "outra" } },
    ], now);

    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({ instagramAccountId: "account-a", signalCount: 2, sentCount: 2, temperature: "INTERESSADO" });
    expect(queue[0].reasons).toContain("2 comentários distintos observados");
    expect(queue[1].instagramAccountId).toBe("account-b");
  });

  it("does not count synthetic direct-message records as comments, but still scores them", () => {
    const queue = buildHeatmapQueue([
      { id: "1", instagramAccountId: "account-a", commenterId: "person", commenterName: null, commentId: "dm:123", commentText: "preço", matchedKeyword: "PREÇO", status: "SENT", createdAt: now, automation: { name: "DM" }, instagramAccount: { username: "loja" } },
    ], now);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ signalCount: 0, score: 15, temperature: "ENGAJADO" });
    expect(queue[0].reasons).toContain("1 mensagem(ns) enviada(s) por essa pessoa");
  });

  it("maps scores to the product temperature bands", () => {
    expect(temperatureForScore(0)).toBe("OBSERVADOR");
    expect(temperatureForScore(9)).toBe("OBSERVADOR");
    expect(temperatureForScore(10)).toBe("ENGAJADO");
    expect(temperatureForScore(25)).toBe("INTERESSADO");
    expect(temperatureForScore(45)).toBe("QUENTE");
    expect(temperatureForScore(70)).toBe("PRIORIDADE");
    expect(temperatureForScore(100)).toBe("PRIORIDADE");
  });

  it("counts one comment once even when several automations logged it", () => {
    const shared = { instagramAccountId: "account-a", commenterId: "person", commenterName: "Ana", commentId: "c1", commentText: "preço", matchedKeyword: "PREÇO", status: "SENT", createdAt: now, instagramAccount: { username: "loja" } };
    const queue = buildHeatmapQueue([
      { id: "1", ...shared, automation: { name: "Oferta" } },
      { id: "2", ...shared, automation: { name: "Outra" } },
    ], now);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ signalCount: 1, score: 18 });
  });

  it("cools down old signals instead of dropping them", () => {
    const older = new Date("2026-06-15T15:00:00.000Z"); // 61 dias atrás → fator 0.4
    const [recent] = buildHeatmapQueue([
      { id: "1", instagramAccountId: "a", commenterId: "p", commenterName: null, commentId: "c1", commentText: "preço", matchedKeyword: "PREÇO", status: "SENT", createdAt: now, automation: { name: "A" }, instagramAccount: { username: "loja" } },
    ], now);
    const [stale] = buildHeatmapQueue([
      { id: "1", instagramAccountId: "a", commenterId: "p", commenterName: null, commentId: "c1", commentText: "preço", matchedKeyword: "PREÇO", status: "SENT", createdAt: older, automation: { name: "A" }, instagramAccount: { username: "loja" } },
    ], now);
    expect(stale.score).toBeLessThan(recent.score);
    expect(stale.score).toBeGreaterThan(0);
  });

  it("ranks the leads that engaged most, hottest first", () => {
    const queue = buildHeatmapQueue([
      // Ana: 3 comentários com palavra-chave + DM recebida + clique no botão.
      { id: "1", instagramAccountId: "a", commenterId: "ana", commenterName: "Ana", commentId: "c1", commentText: "preço", matchedKeyword: "PREÇO", status: "SENT", createdAt: now, automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
      { id: "2", instagramAccountId: "a", commenterId: "ana", commenterName: "Ana", commentId: "c2", commentText: "quero", matchedKeyword: "QUERO", status: "SENT", createdAt: now, automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
      { id: "3", instagramAccountId: "a", commenterId: "ana", commenterName: "Ana", commentId: "c3", commentText: "link", matchedKeyword: "LINK", status: "SENT", createdAt: now, automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
      { id: "4", instagramAccountId: "a", commenterId: "ana", commenterName: "Ana", commentId: "dm:9", commentText: "como compro?", matchedKeyword: null, status: "SENT", createdAt: now, automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
      { id: "5", instagramAccountId: "a", commenterId: "ana", commenterName: "Ana", commentId: "reveal:ana", commentText: "", matchedKeyword: null, status: "SENT", createdAt: now, automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
      // Bruno: um comentário solto, sem palavra-chave.
      { id: "6", instagramAccountId: "a", commenterId: "bruno", commenterName: "Bruno", commentId: "c9", commentText: "oi", matchedKeyword: null, status: "SENT", createdAt: now, automation: { name: "Oferta" }, instagramAccount: { username: "loja" } },
    ], now);

    const top = queue; // a fila já sai ordenada do mais quente para o mais frio
    expect(top.map((item) => item.commenterId)).toEqual(["ana", "bruno"]);
    expect(top[0]).toMatchObject({ temperature: "PRIORIDADE", score: 88 });
    expect(top[0].latestComment).toBe("preço"); // texto vem do comentário, não da DM
    expect(top[1].temperature).toBe("OBSERVADOR");
    expect(countByTemperature(queue)).toMatchObject({ PRIORIDADE: 1, OBSERVADOR: 1, QUENTE: 0 });
  });
});
