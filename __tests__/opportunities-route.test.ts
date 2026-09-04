import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fingerprintRequest } from "@/lib/crm/event-metadata";

const { context, mockAccess, mockPrisma, tx } = vi.hoisted(() => {
  const context = {
    userId: "user_1",
    workspaceId: "workspace_1",
    workspace: { id: "workspace_1" },
    role: "MEMBER" as const,
  };
  const tx = {
    leadEvent: { findUnique: vi.fn(), create: vi.fn() },
    lead: { findFirst: vi.fn(), updateMany: vi.fn() },
    workspaceMember: { findUnique: vi.fn(), findFirst: vi.fn() },
    sale: { create: vi.fn() },
  };
  return {
    context,
    tx,
    mockAccess: { getCurrentWorkspaceContext: vi.fn() },
    mockPrisma: {
      lead: { findMany: vi.fn(), findFirst: vi.fn() },
      instagramAccount: { findFirst: vi.fn() },
      dmLog: { findMany: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/workspace-access", () => mockAccess);

import { GET as listOpportunities } from "@/app/api/opportunities/route";
import {
  GET as getOpportunity,
  PATCH as patchOpportunity,
} from "@/app/api/opportunities/[id]/route";

const now = new Date("2026-09-02T12:00:00.000Z");
const detailRow = {
  id: "lead_1",
  commenterId: "person_1",
  commenterName: "Pessoa",
  status: "NOVO" as const,
  note: null,
  productOffer: null,
  potentialValueCents: null,
  nextAction: null,
  nextActionAt: null,
  lossReason: null,
  lastContactedAt: null,
  newAt: now,
  approachedAt: null,
  respondedAt: null,
  negotiatingAt: null,
  wonAt: null,
  lostAt: null,
  intentCategory: "PRICE" as const,
  intentSignals: ["price_term"],
  intentSource: "RULE" as const,
  intentCorrectedAt: null,
  originType: "COMMENT" as const,
  originCommentId: "comment_1",
  originMessageId: null,
  originPostId: "post_1",
  originKeyword: "preço",
  originText: "preço?",
  version: 1,
  createdAt: now,
  updatedAt: now,
  instagramAccount: { id: "account_1", username: "brand" },
  assignee: null,
  sourceAutomation: { id: "automation_1", name: "Oferta" },
  events: [],
  sales: [],
};

const props = { params: Promise.resolve({ id: "lead_1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.getCurrentWorkspaceContext.mockResolvedValue(context);
  mockPrisma.lead.findMany.mockResolvedValue([]);
  mockPrisma.dmLog.findMany.mockResolvedValue([]);
  mockPrisma.lead.findFirst.mockResolvedValue(detailRow);
  mockPrisma.instagramAccount.findFirst.mockResolvedValue({ id: "account_1" });
  tx.leadEvent.findUnique.mockResolvedValue(null);
  tx.lead.findFirst.mockResolvedValue({
    id: "lead_1",
    status: "NOVO",
    version: 1,
    lossReason: null,
    assigneeMemberId: null,
    sales: [],
  });
  tx.workspaceMember.findUnique.mockResolvedValue({ id: "member_1" });
  tx.workspaceMember.findFirst.mockResolvedValue(null);
  tx.lead.updateMany.mockResolvedValue({ count: 1 });
  tx.leadEvent.create.mockResolvedValue({});
  tx.sale.create.mockResolvedValue({ id: "sale_1" });
});

describe("opportunities API tenancy and concurrency", () => {
  it("always scopes list queries to the implicit workspace", async () => {
    const response = await listOpportunities(
      new NextRequest("http://localhost/api/opportunities?status=NOVO")
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "workspace_1", status: "NOVO" }),
      })
    );
  });

  it("filters by an Instagram account only after confirming workspace ownership", async () => {
    const response = await listOpportunities(
      new NextRequest(
        "http://localhost/api/opportunities?instagramAccountId=account_1&commenterId=person_1&assigneeMemberId=member_1&intentCategory=PRICE&limit=10"
      )
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "account_1", workspaceId: "workspace_1" },
      select: { id: true },
    });
    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace_1",
          instagramAccountId: "account_1",
          commenterId: "person_1",
          assigneeMemberId: "member_1",
          intentCategory: "PRICE",
        }),
        take: 11,
      })
    );
  });

  it("returns an empty paginated list for an Instagram account outside the workspace", async () => {
    mockPrisma.instagramAccount.findFirst.mockResolvedValue(null);

    const response = await listOpportunities(
      new NextRequest(
        "http://localhost/api/opportunities?instagramAccountId=foreign_account&limit=10"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: {
        items: [],
        page: { limit: 10, hasMore: false, nextCursor: null },
        sort: "recent",
        window: null,
      },
    });
    expect(mockPrisma.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign_account", workspaceId: "workspace_1" },
      select: { id: true },
    });
    expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 instead of revealing an opportunity from another workspace", async () => {
    mockPrisma.lead.findFirst.mockResolvedValue(null);
    const response = await getOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_other"),
      { params: Promise.resolve({ id: "lead_other" }) }
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "lead_other", workspaceId: "workspace_1" } })
    );
  });

  it("returns the current version on an optimistic concurrency conflict", async () => {
    tx.lead.findFirst.mockResolvedValueOnce({
      id: "lead_1",
      status: "NOVO",
      version: 2,
      lossReason: null,
      assigneeMemberId: null,
      sales: [],
    });
    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "request-001",
          status: "ABORDADO",
        }),
      }),
      props
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      success: false,
      code: "VERSION_CONFLICT",
      data: { currentVersion: 2 },
    });
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });

  it("replays the same idempotent command without updating twice", async () => {
    const body = {
      expectedVersion: 1,
      idempotencyKey: "request-001",
      status: "ABORDADO" as const,
    };
    tx.leadEvent.findUnique.mockResolvedValue({ requestFingerprint: fingerprintRequest(body) });
    tx.lead.findFirst.mockResolvedValue(detailRow);

    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      props
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.replayed).toBe(true);
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });

  it("prevents a member from assigning a peer", async () => {
    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "request-002",
          assigneeMemberId: "member_2",
        }),
      }),
      props
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.code).toBe("ASSIGNEE_FORBIDDEN");
    expect(tx.workspaceMember.findFirst).not.toHaveBeenCalled();
  });

  it("does not let an admin assign a member id from another workspace", async () => {
    mockAccess.getCurrentWorkspaceContext.mockResolvedValue({ ...context, role: "ADMIN" });
    tx.workspaceMember.findFirst.mockResolvedValue(null);

    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "request-003",
          assigneeMemberId: "foreign_member",
        }),
      }),
      props
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe("INVALID_ASSIGNEE");
    expect(tx.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign_member", workspaceId: "workspace_1" },
      select: { id: true },
    });
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });

  it("confirms a UI-entered win as a MANUAL sale in the same transaction", async () => {
    tx.lead.findFirst
      .mockResolvedValueOnce({
        id: "lead_1",
        status: "NEGOCIANDO",
        version: 1,
        lossReason: null,
        assigneeMemberId: null,
        sales: [],
      })
      .mockResolvedValueOnce({
        ...detailRow,
        status: "GANHO",
        version: 2,
        sales: [
          {
            id: "sale_1",
            status: "CONFIRMED",
            amountCents: 12_500,
            currency: "BRL",
            source: "MANUAL",
            confirmedAt: now,
            voidedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "request-win-1",
          status: "GANHO",
          sale: { amountCents: 12_500, currency: "brl" },
        }),
      }),
      props
    );

    expect(response.status).toBe(200);
    expect(tx.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace_1",
        leadId: "lead_1",
        status: "CONFIRMED",
        amountCents: 12_500,
        currency: "BRL",
        source: "MANUAL",
        confirmedAt: expect.any(Date),
      }),
      select: { id: true },
    });
    expect(tx.leadEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "STATUS_CHANGED", toStatus: "GANHO" }),
    });
  });

  it("does not reopen a win while its confirmed sale remains active", async () => {
    tx.lead.findFirst.mockResolvedValueOnce({
      id: "lead_1",
      status: "GANHO",
      version: 2,
      lossReason: null,
      assigneeMemberId: null,
      sales: [{ id: "sale_1" }],
    });

    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "request-reopen-win",
          status: "NEGOCIANDO",
        }),
      }),
      props
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ code: "INVALID_OUTCOME" });
    expect(payload.error).toMatch(/anulação explícita/i);
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });

  it("does not append a second confirmed sale to a won opportunity", async () => {
    tx.lead.findFirst.mockResolvedValueOnce({
      id: "lead_1",
      status: "GANHO",
      version: 2,
      lossReason: null,
      assigneeMemberId: null,
      sales: [{ id: "sale_1" }],
    });

    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "request-second-sale",
          status: "GANHO",
          sale: { amountCents: 5_000, currency: "BRL" },
        }),
      }),
      props
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ code: "INVALID_OUTCOME" });
    expect(payload.error).toMatch(/já possui uma venda confirmada/i);
    expect(tx.sale.create).not.toHaveBeenCalled();
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });

  it("does not silently reopen a lost opportunity", async () => {
    tx.lead.findFirst.mockResolvedValueOnce({
      id: "lead_1",
      status: "PERDIDO",
      version: 4,
      lossReason: "Sem orçamento",
      assigneeMemberId: null,
      sales: [],
    });

    const response = await patchOpportunity(
      new NextRequest("http://localhost/api/opportunities/lead_1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 4,
          idempotencyKey: "request-reopen-loss",
          status: "NEGOCIANDO",
        }),
      }),
      props
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ code: "INVALID_OUTCOME" });
    expect(payload.error).toMatch(/reaberta.*auditada/i);
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });
});

describe("opportunities list ordered by engagement", () => {
  const signalNow = new Date();

  function signal(overrides: { commenterId: string; commentId: string; matchedKeyword?: string | null }) {
    return {
      id: `log_${overrides.commentId}`,
      instagramAccountId: "account_1",
      commenterId: overrides.commenterId,
      commenterName: null,
      commentText: "",
      commentId: overrides.commentId,
      matchedKeyword: overrides.matchedKeyword ?? null,
      status: "SENT",
      createdAt: signalNow,
      automation: { name: "Oferta" },
      instagramAccount: { username: "brand" },
    };
  }

  function leadRow(id: string, commenterId: string) {
    return { ...detailRow, id, commenterId };
  }

  it("lê os sinais só dos últimos 7 dias e dentro do workspace", async () => {
    await listOpportunities(
      new NextRequest("http://localhost/api/opportunities?sort=engagement")
    );

    expect(mockPrisma.dmLog.findMany).toHaveBeenCalledTimes(2);
    for (const [call] of mockPrisma.dmLog.findMany.mock.calls) {
      expect(call.where.workspaceId).toBe("workspace_1");
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const elapsed = Date.now() - call.where.createdAt.gte.getTime();
      expect(Math.abs(elapsed - sevenDaysMs)).toBeLessThan(5_000);
    }
  });

  it("devolve a fila do mais engajado para o menos engajado", async () => {
    mockPrisma.dmLog.findMany
      .mockResolvedValueOnce([
        signal({ commenterId: "quente", commentId: "c1", matchedKeyword: "quero comprar" }),
        signal({ commenterId: "frio", commentId: "c2" }),
      ])
      .mockResolvedValueOnce([signal({ commenterId: "quente", commentId: "dm:1" })]);
    mockPrisma.lead.findMany.mockResolvedValue([
      leadRow("lead_frio", "frio"),
      leadRow("lead_quente", "quente"),
    ]);

    const response = await listOpportunities(
      new NextRequest("http://localhost/api/opportunities?sort=engagement")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.sort).toBe("engagement");
    expect(payload.data.window.period).toBe("7d");
    expect(payload.data.items.map((item: { id: string }) => item.id)).toEqual([
      "lead_quente",
      "lead_frio",
    ]);
    expect(payload.data.items[0].engagement.score).toBeGreaterThan(
      payload.data.items[1].engagement.score
    );
    expect(payload.data.items[0].engagement.temperature).toBeTruthy();
  });

  it("busca só as oportunidades de quem teve sinal no período, sem sair do workspace", async () => {
    mockPrisma.dmLog.findMany
      .mockResolvedValueOnce([signal({ commenterId: "person_1", commentId: "c1" })])
      .mockResolvedValueOnce([]);

    await listOpportunities(
      new NextRequest("http://localhost/api/opportunities?sort=engagement&status=NOVO")
    );

    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace_1",
          status: "NOVO",
          commenterId: { in: ["person_1"] },
        }),
      })
    );
  });

  it("não consulta oportunidades quando não houve nenhum sinal no período", async () => {
    const response = await listOpportunities(
      new NextRequest("http://localhost/api/opportunities?sort=engagement")
    );
    const payload = await response.json();

    expect(payload.data.items).toEqual([]);
    expect(payload.data.window.truncated).toBe(false);
    expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
  });

  it("avisa quando a amostra de sinais estourou o teto em vez de fingir ordem completa", async () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      signal({ commenterId: `person_${index}`, commentId: `c${index}` })
    );
    mockPrisma.dmLog.findMany.mockResolvedValueOnce(many).mockResolvedValueOnce([]);
    mockPrisma.lead.findMany.mockResolvedValue([]);

    const response = await listOpportunities(
      new NextRequest("http://localhost/api/opportunities?sort=engagement")
    );
    const payload = await response.json();

    expect(payload.data.window.truncated).toBe(true);
  });

  it("pagina pela chave da própria ordem e recusa o cursor da outra", async () => {
    mockPrisma.dmLog.findMany
      .mockResolvedValueOnce([
        signal({ commenterId: "quente", commentId: "c1", matchedKeyword: "quero comprar" }),
        signal({ commenterId: "frio", commentId: "c2" }),
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.lead.findMany.mockResolvedValue([
      leadRow("lead_quente", "quente"),
      leadRow("lead_frio", "frio"),
    ]);

    const firstPage = await listOpportunities(
      new NextRequest("http://localhost/api/opportunities?sort=engagement&limit=1")
    );
    const first = await firstPage.json();

    expect(first.data.items.map((item: { id: string }) => item.id)).toEqual(["lead_quente"]);
    expect(first.data.page.hasMore).toBe(true);

    mockPrisma.dmLog.findMany
      .mockResolvedValueOnce([
        signal({ commenterId: "quente", commentId: "c1", matchedKeyword: "quero comprar" }),
        signal({ commenterId: "frio", commentId: "c2" }),
      ])
      .mockResolvedValueOnce([]);

    const secondPage = await listOpportunities(
      new NextRequest(
        `http://localhost/api/opportunities?sort=engagement&limit=1&cursor=${encodeURIComponent(first.data.page.nextCursor)}`
      )
    );
    const second = await secondPage.json();

    expect(second.data.items.map((item: { id: string }) => item.id)).toEqual(["lead_frio"]);
    expect(second.data.page.hasMore).toBe(false);

    const recentCursor = Buffer.from(
      JSON.stringify({ updatedAt: now.toISOString(), id: "lead_1" }),
      "utf8"
    ).toString("base64url");
    const rejected = await listOpportunities(
      new NextRequest(
        `http://localhost/api/opportunities?sort=engagement&cursor=${encodeURIComponent(recentCursor)}`
      )
    );

    expect(rejected.status).toBe(400);
  });

  it("mantém a ordem por recência intacta no modo padrão", async () => {
    await listOpportunities(new NextRequest("http://localhost/api/opportunities"));

    expect(mockPrisma.dmLog.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }] })
    );
  });
});
