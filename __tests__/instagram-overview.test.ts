import { beforeEach, describe, expect, it, vi } from "vitest";

// PermissionError has to be created inside vi.hoisted: vi.mock factories are
// hoisted above the module body, so a `class` declared below would still be in
// its temporal dead zone when the factory runs.
const {
  mockPrisma,
  mockAuth,
  mockAccounts,
  mockMeta,
  mockOauth,
  mockFollowers,
  PermissionError,
} = vi.hoisted(() => ({
  mockPrisma: { instagramAccount: { findMany: vi.fn() } },
  mockAuth: { getCurrentWorkspaceId: vi.fn() },
  mockAccounts: { getWorkspaceInstagramAccount: vi.fn() },
  mockMeta: { getAllUserMedia: vi.fn(), getMediaInsights: vi.fn() },
  mockOauth: { decryptToken: vi.fn() },
  mockFollowers: { ensureFollowerHistory: vi.fn(), getFollowerHistory: vi.fn() },
  PermissionError: class PermissionError extends Error {},
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => mockAuth);
vi.mock("@/lib/instagram-accounts", () => mockAccounts);
vi.mock("@/lib/meta/oauth", () => mockOauth);
vi.mock("@/lib/reports/follower-history", () => mockFollowers);
vi.mock("@/lib/meta/client", () => ({ ...mockMeta, PermissionError }));

import { GET, type OverviewResponse } from "@/app/api/instagram/overview/route";

// A rota só lê request.nextUrl.searchParams.
const request = (query = "count=25") =>
  ({ nextUrl: new URL(`http://localhost/api/instagram/overview?${query}`) }) as never;

/** Um post cru da Graph API, com só o que a rota consome. */
const media = (
  id: string,
  comments: number,
  likes: number,
  timestamp = "2026-01-01T00:00:00+0000"
) => ({
  id,
  media_type: "IMAGE",
  timestamp,
  like_count: likes,
  comments_count: comments,
});

async function load(): Promise<OverviewResponse> {
  const response = await GET(request());
  const body = await response.json();
  expect(body.success).toBe(true);
  return body.data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getCurrentWorkspaceId.mockResolvedValue("workspace_1");
  mockAccounts.getWorkspaceInstagramAccount.mockResolvedValue({
    id: "account_1",
    instagramId: "ig_1",
    username: "conta",
    accessToken: "cipher",
  });
  mockOauth.decryptToken.mockReturnValue("token");
  mockPrisma.instagramAccount.findMany.mockResolvedValue([
    { id: "account_1", username: "conta" },
  ]);
  // Devolve o perfil inteiro: a rota lê followers_count, nome e avatar daqui.
  mockFollowers.ensureFollowerHistory.mockResolvedValue({
    username: "conta",
    name: "Conta Teste",
    profile_picture_url: "https://cdn/avatar.jpg",
    followers_count: 100,
  });
  mockFollowers.getFollowerHistory.mockResolvedValue([]);
});

describe("GET /api/instagram/overview — métricas sem a permissão de insights", () => {
  it("devolve null, e não 0, quando nenhum post reportou a métrica", async () => {
    mockMeta.getAllUserMedia.mockResolvedValue([media("a", 3, 10), media("b", 1, 20)]);
    mockMeta.getMediaInsights.mockRejectedValue(new PermissionError("sem escopo"));

    const data = await load();

    expect(data.totals.views).toBeNull();
    expect(data.totals.reach).toBeNull();
    expect(data.totals.saved).toBeNull();
    expect(data.totals.shares).toBeNull();
    // Curtidas e comentários vêm dos campos básicos: continuam somando.
    expect(data.totals.likes).toBe(30);
    expect(data.totals.comments).toBe(4);
    expect(data.insightsAvailable).toBe(false);
  });

  it("não marca insights como disponíveis quando só um post respondeu", async () => {
    mockMeta.getAllUserMedia.mockResolvedValue([media("a", 3, 10), media("b", 1, 20)]);
    mockMeta.getMediaInsights
      .mockResolvedValueOnce({ reach: 500, saved: 2, shares: 1 })
      .mockRejectedValueOnce(new PermissionError("sem escopo"));

    const data = await load();

    expect(data.insightsAvailable).toBe(false);
    // A soma parcial é preservada — o que falta é desconhecido, não zero.
    expect(data.totals.reach).toBe(500);
    expect(data.posts.find((p) => p.id === "b")?.reach).toBeNull();
  });

  it("marca insights como disponíveis só quando todos os posts respondem", async () => {
    mockMeta.getAllUserMedia.mockResolvedValue([media("a", 3, 10), media("b", 1, 20)]);
    mockMeta.getMediaInsights.mockResolvedValue({ reach: 100, saved: 1, shares: 0 });

    const data = await load();

    expect(data.insightsAvailable).toBe(true);
    expect(data.totals.reach).toBe(200);
  });

  it("não publica taxa de engajamento sem alcance medido", async () => {
    mockMeta.getAllUserMedia.mockResolvedValue([media("a", 3, 10)]);
    mockMeta.getMediaInsights.mockRejectedValue(new PermissionError("sem escopo"));

    const data = await load();

    expect(data.totals.interactions).toBeNull();
    expect(data.engagementRate).toBeNull();
  });

  it("calcula a taxa de engajamento quando interações e alcance vêm medidos", async () => {
    mockMeta.getAllUserMedia.mockResolvedValue([media("a", 3, 10)]);
    mockMeta.getMediaInsights.mockResolvedValue({
      reach: 200,
      total_interactions: 50,
    });

    const data = await load();

    expect(data.totals.interactions).toBe(50);
    expect(data.engagementRate).toBe(25);
  });

  it("trata resposta vazia da Meta como insights indisponíveis", async () => {
    mockMeta.getAllUserMedia.mockResolvedValue([media("a", 3, 10)]);
    mockMeta.getMediaInsights.mockResolvedValue({});

    const data = await load();

    expect(data.insightsAvailable).toBe(false);
    expect(data.totals.reach).toBeNull();
  });
});

describe("GET /api/instagram/overview — ordenação das publicações", () => {
  beforeEach(() => {
    mockMeta.getMediaInsights.mockRejectedValue(new PermissionError("sem escopo"));
  });

  it("ordena por comentários, com curtidas como desempate", async () => {
    mockMeta.getAllUserMedia.mockResolvedValue([
      media("baixo", 1, 999),
      media("alto", 9, 0),
      media("empate-menos-curtidas", 9, 5),
    ]);

    const data = await load();

    expect(data.posts.map((p) => p.id)).toEqual([
      "empate-menos-curtidas",
      "alto",
      "baixo",
    ]);
  });

  it("é determinística no empate total: mais recente primeiro, depois id", async () => {
    const input = [
      media("c", 5, 5, "2026-02-01T00:00:00+0000"),
      media("a", 5, 5, "2026-02-01T00:00:00+0000"),
      media("b", 5, 5, "2026-03-01T00:00:00+0000"),
    ];
    mockMeta.getAllUserMedia.mockResolvedValue(input);
    const first = await load();

    // Mesma entrada em outra ordem não pode mudar o resultado.
    mockMeta.getAllUserMedia.mockResolvedValue([...input].reverse());
    const second = await load();

    expect(first.posts.map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(second.posts.map((p) => p.id)).toEqual(first.posts.map((p) => p.id));
  });
});
