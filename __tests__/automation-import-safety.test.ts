import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockAccess, mockAccounts, mockPrisma } = vi.hoisted(() => ({
  mockAccess: { getCurrentWorkspaceContext: vi.fn() },
  mockAccounts: { getWorkspaceInstagramAccount: vi.fn() },
  mockPrisma: {
    automation: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: mockAccess.getCurrentWorkspaceContext,
  canManageWorkspace: () => true,
}));
vi.mock("@/lib/instagram-accounts", () => mockAccounts);
vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/automations/import/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.getCurrentWorkspaceContext.mockResolvedValue({
    userId: "user_1",
    workspaceId: "workspace_1",
    role: "ADMIN",
  });
  mockAccounts.getWorkspaceInstagramAccount.mockResolvedValue({
    id: "account_1",
  });
  mockPrisma.automation.findMany.mockResolvedValue([]);
  mockPrisma.automation.create.mockResolvedValue({ id: "campaign_1" });
});

describe("campaign import safety", () => {
  it("always creates imported campaigns paused, including payloads marked active", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/automations/import", {
        method: "POST",
        body: JSON.stringify({
          instagramAccountId: "account_1",
          campaigns: [
            {
              postId: "post_1",
              keywords: ["preco"],
              dmMessage: "Mensagem um",
              isActive: true,
            },
            {
              postId: "post_2",
              keywords: ["link"],
              dmMessage: "Mensagem dois",
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.automation.create).toHaveBeenCalledTimes(2);
    for (const call of mockPrisma.automation.create.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: "workspace_1",
            instagramAccountId: "account_1",
            isActive: false,
            reportShareEnabled: false,
          }),
        })
      );
    }
  });
});
