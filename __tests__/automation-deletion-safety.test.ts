import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockAccess, mockPrisma } = vi.hoisted(() => ({
  mockAccess: {
    getCurrentWorkspaceContext: vi.fn(),
    canManageWorkspace: vi.fn(() => true),
  },
  mockPrisma: {
    automation: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ getCurrentWorkspaceId: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/workspace-access", () => mockAccess);

import { DELETE, PATCH } from "@/app/api/automations/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.getCurrentWorkspaceContext.mockResolvedValue({
    userId: "user_1",
    workspaceId: "workspace_1",
    role: "ADMIN",
  });
  mockPrisma.automation.findFirst.mockResolvedValue({
    id: "campaign_1",
    postId: "post_1",
    pendingNextReel: false,
    matchAnyPost: false,
    keywords: ["QUERO"],
    matchAnyWord: false,
    dmMessage: "Olá!",
    openingDmEnabled: false,
    openingDmMessage: null,
    openingDmButtonLabel: null,
    publicReplyEnabled: false,
    publicReplyMessage: null,
    publicReplyMessages: [],
    requireFollow: false,
    followPromptMessage: null,
    followUpEnabled: false,
    followUpMessage: null,
    trackedLinks: [],
  });
  mockPrisma.automation.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.automation.update.mockResolvedValue({ id: "campaign_1", isActive: true });
});

describe("campaign activation safety at the API boundary", () => {
  it("rejects activation without an explicit operator confirmation", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/automations?id=campaign_1", {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe("ACTIVATION_CONFIRMATION_REQUIRED");
    expect(mockPrisma.automation.update).not.toHaveBeenCalled();
  });

  it("activates a complete campaign after explicit confirmation", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/automations?id=campaign_1", {
        method: "PATCH",
        body: JSON.stringify({ isActive: true, activationConfirmed: true }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.automation.update).toHaveBeenCalledWith({
      where: { id: "campaign_1" },
      data: { isActive: true },
    });
  });
});

describe("campaign deletion safety", () => {
  it("only deletes the selected empty campaign inside the workspace", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/automations?id=campaign_1", {
        method: "DELETE",
      })
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.automation.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "campaign_1",
        workspaceId: "workspace_1",
        dmLogs: { none: {} },
        linkClicks: { none: {} },
        sourcedLeads: { none: {} },
      },
    });
  });

  it("returns a conflict when persisted activity prevents deletion", async () => {
    mockPrisma.automation.deleteMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(
      new NextRequest("http://localhost/api/automations?id=campaign_1", {
        method: "DELETE",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe("CAMPAIGN_HISTORY_REQUIRES_RETENTION");
  });

  it("does not reveal or delete a campaign from another workspace", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("http://localhost/api/automations?id=campaign_other", {
        method: "DELETE",
      })
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.automation.deleteMany).not.toHaveBeenCalled();
  });
});
