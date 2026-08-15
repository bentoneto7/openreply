import { describe, expect, it } from "vitest";
import { buildHeatmapQueue, periodStart } from "@/lib/heatmap/priority";

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
    expect(queue[0]).toMatchObject({ instagramAccountId: "account-a", signalCount: 2, sentCount: 2, priorityLabel: "Revisar primeiro" });
    expect(queue[0].reasons).toContain("2 comentários distintos observados");
    expect(queue[1].instagramAccountId).toBe("account-b");
  });

  it("does not count synthetic direct-message records as comments", () => {
    const queue = buildHeatmapQueue([
      { id: "1", instagramAccountId: "account-a", commenterId: "person", commenterName: null, commentId: "dm:123", commentText: "preço", matchedKeyword: "PREÇO", status: "SENT", createdAt: now, automation: { name: "DM" }, instagramAccount: { username: "loja" } },
    ], now);
    expect(queue).toEqual([]);
  });
});
