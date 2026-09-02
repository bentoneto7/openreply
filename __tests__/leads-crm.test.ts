import { beforeEach, describe, expect, it, vi } from "vitest";
import { fingerprintRequest } from "@/lib/crm/event-metadata";

const { mockAccess, mockPrisma, tx } = vi.hoisted(() => {
  const tx = {
    instagramAccount: { findFirst: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    leadEvent: { findUnique: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    mockAccess: { getCurrentWorkspaceContext: vi.fn() },
    mockPrisma: { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) },
  };
});
vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/workspace-access", () => mockAccess);

import { PATCH } from "@/app/api/leads/route";

const request = (body: unknown) => ({ json: async () => body }) as never;
const validBody = {
  instagramAccountId: "account_1",
  commenterId: "person_1",
  status: "ABORDADO",
};
const now = new Date("2026-09-02T12:00:00.000Z");
const createdLead = {
  id: "lead_1",
  instagramAccountId: "account_1",
  commenterId: "person_1",
  commenterName: null,
  status: "ABORDADO",
  note: null,
  lastContactedAt: now,
  newAt: now,
  approachedAt: now,
  respondedAt: null,
  negotiatingAt: null,
  version: 1,
  updatedAt: now,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.getCurrentWorkspaceContext.mockResolvedValue({
    userId: "user_1",
    workspaceId: "workspace_1",
    role: "MEMBER",
    workspace: { id: "workspace_1" },
  });
  tx.instagramAccount.findFirst.mockResolvedValue({ id: "account_1" });
  tx.workspaceMember.findUnique.mockResolvedValue({ id: "member_1" });
  tx.lead.findFirst.mockResolvedValue(null);
  tx.lead.create.mockResolvedValue(createdLead);
  tx.lead.updateMany.mockResolvedValue({ count: 1 });
  tx.leadEvent.findUnique.mockResolvedValue(null);
  tx.leadEvent.create.mockResolvedValue({});
});

describe("PATCH /api/leads legacy bridge", () => {
  it("refuses an unauthenticated caller", async () => {
    mockAccess.getCurrentWorkspaceContext.mockResolvedValue(null);
    const response = await PATCH(request(validBody));

    expect(response.status).toBe(401);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to write through an account from another workspace", async () => {
    tx.instagramAccount.findFirst.mockResolvedValue(null);
    const response = await PATCH(request(validBody));

    expect(response.status).toBe(404);
    expect(tx.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "account_1", workspaceId: "workspace_1" },
      select: { id: true },
    });
    expect(tx.lead.create).not.toHaveBeenCalled();
  });

  it.each(["GANHO", "PERDIDO"])("blocks %s because closing uses the opportunity contract", async (status) => {
    const response = await PATCH(request({ ...validBody, status }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe("OPPORTUNITY_OUTCOME_REQUIRED");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(["GANHO", "PERDIDO"])(
    "does not reopen an existing terminal %s through the legacy bridge",
    async (currentStatus) => {
      tx.lead.findFirst.mockResolvedValue({ id: "lead_1", status: currentStatus, version: 4 });

      const response = await PATCH(request(validBody));
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.code).toBe("OPPORTUNITY_OUTCOME_REQUIRED");
      expect(tx.lead.updateMany).not.toHaveBeenCalled();
      expect(tx.leadEvent.create).not.toHaveBeenCalled();
    }
  );

  it("rejects an unknown status", async () => {
    const response = await PATCH(request({ ...validBody, status: "GANHOU_TALVEZ" }));

    expect(response.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates an open lead with its stage timestamp and an auditable actor", async () => {
    const response = await PATCH(request(validBody));

    expect(response.status).toBe(200);
    expect(tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace_1",
          status: "ABORDADO",
          approachedAt: expect.any(Date),
          lastContactedAt: expect.any(Date),
          originType: "MANUAL",
        }),
      })
    );
    expect(tx.leadEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace_1",
        leadId: "lead_1",
        type: "STATUS_CHANGED",
        fromStatus: null,
        toStatus: "ABORDADO",
        actorMemberId: "member_1",
        actorWorkspaceId: "workspace_1",
      }),
    });
  });

  it("increments version atomically while preserving an omitted note", async () => {
    const current = { id: "lead_1", status: "NOVO", version: 3 };
    tx.lead.findFirst
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ ...createdLead, version: 4 });

    const response = await PATCH(request({ ...validBody, expectedVersion: 3 }));

    expect(response.status).toBe(200);
    expect(tx.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead_1", workspaceId: "workspace_1", version: 3 },
        data: expect.objectContaining({
          status: "ABORDADO",
          version: { increment: 1 },
          approachedAt: expect.any(Date),
        }),
      })
    );
    expect(tx.lead.updateMany.mock.calls[0][0].data).not.toHaveProperty("note");
  });

  it("returns a version conflict before overwriting a concurrent change", async () => {
    tx.lead.findFirst.mockResolvedValue({ id: "lead_1", status: "NOVO", version: 4 });

    const response = await PATCH(request({ ...validBody, expectedVersion: 3 }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ code: "VERSION_CONFLICT", data: { currentVersion: 4 } });
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });

  it("replays a caller-provided idempotency key without a second write", async () => {
    const body = { ...validBody, idempotencyKey: "request-legacy-1" };
    tx.lead.findFirst
      .mockResolvedValueOnce({ id: "lead_1", status: "NOVO", version: 1 })
      .mockResolvedValueOnce(createdLead);
    tx.leadEvent.findUnique.mockResolvedValue({ requestFingerprint: fingerprintRequest(body) });

    const response = await PATCH(request(body));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.replayed).toBe(true);
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
    expect(tx.leadEvent.create).not.toHaveBeenCalled();
  });
});
