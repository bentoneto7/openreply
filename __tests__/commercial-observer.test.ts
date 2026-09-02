import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, tx } = vi.hoisted(() => {
  const tx = {
    instagramAccount: { findFirst: vi.fn() },
    automation: { findFirst: vi.fn() },
    lead: { upsert: vi.fn(), updateMany: vi.fn() },
    leadEvent: { findUnique: vi.fn(), createMany: vi.fn() },
  };
  return {
    tx,
    mockPrisma: { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import { observeCommercialLead } from "@/lib/crm/observe-lead";

const observation = {
  workspaceId: "workspace_1",
  instagramAccountId: "account_1",
  commenterId: "person_1",
  commenterName: "Pessoa",
  sourceAutomationId: "automation_1",
  originType: "COMMENT" as const,
  originCommentId: "comment_1",
  originPostId: "post_1",
  originKeyword: "preço",
  originText: "Qual é o preço?",
  sourceEventKey: "worker:comment:automation_1:comment_1",
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.instagramAccount.findFirst.mockResolvedValue({ id: "account_1" });
  tx.automation.findFirst.mockResolvedValue({ id: "automation_1" });
  tx.lead.upsert.mockResolvedValue({
    id: "lead_1",
    originType: "COMMENT",
    sourceAutomationId: "automation_1",
    intentSource: "RULE",
  });
  tx.lead.updateMany.mockResolvedValue({ count: 1 });
  tx.leadEvent.findUnique.mockResolvedValue(null);
  tx.leadEvent.createMany.mockResolvedValue({ count: 1 });
});

describe("commercial lead observation", () => {
  it("scopes both referenced resources to the workspace", async () => {
    await observeCommercialLead(observation);

    expect(tx.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "account_1", workspaceId: "workspace_1" },
      select: { id: true },
    });
    expect(tx.automation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "automation_1",
          workspaceId: "workspace_1",
          instagramAccountId: "account_1",
        },
      })
    );
  });

  it("rejects cross-tenant references before creating a lead", async () => {
    tx.instagramAccount.findFirst.mockResolvedValue(null);

    await expect(observeCommercialLead(observation)).rejects.toThrow(/outside its workspace/i);
    expect(tx.lead.upsert).not.toHaveBeenCalled();
    expect(tx.leadEvent.createMany).not.toHaveBeenCalled();
  });

  it("uses a stable event key with database duplicate skipping", async () => {
    await observeCommercialLead(observation);
    await observeCommercialLead(observation);

    for (const call of tx.leadEvent.createMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              workspaceId: "workspace_1",
              leadId: "lead_1",
              sourceEventKey: "worker:comment:automation_1:comment_1",
            }),
          ],
          skipDuplicates: true,
        })
      );
    }
  });

  it("does not mutate the lead when the source event is retried", async () => {
    tx.leadEvent.findUnique.mockResolvedValue({ leadId: "lead_1" });

    await observeCommercialLead(observation);

    expect(tx.lead.upsert).not.toHaveBeenCalled();
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
    expect(tx.leadEvent.createMany).not.toHaveBeenCalled();
  });

  it("does not overwrite an intent corrected by a person", async () => {
    tx.lead.upsert.mockResolvedValue({
      id: "lead_1",
      originType: "COMMENT",
      sourceAutomationId: "automation_1",
      intentSource: "HUMAN",
    });

    await observeCommercialLead(observation);

    expect(tx.lead.updateMany).not.toHaveBeenCalled();
    expect(tx.leadEvent.createMany).toHaveBeenCalledOnce();
  });
});
