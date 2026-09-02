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
