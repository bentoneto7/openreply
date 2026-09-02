import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAccess, mockPrisma } = vi.hoisted(() => ({
  mockAccess: {
    getCurrentWorkspaceContext: vi.fn(),
    canManageWorkspace: vi.fn(),
  },
  mockPrisma: {
    instagramAccount: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/workspace-access", () => mockAccess);

import { POST } from "@/app/api/instagram/disconnect/route";

function request(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.getCurrentWorkspaceContext.mockResolvedValue({
    userId: "user_1",
    workspaceId: "workspace_1",
    role: "ADMIN",
    workspace: { id: "workspace_1" },
  });
  mockAccess.canManageWorkspace.mockReturnValue(true);
  mockPrisma.instagramAccount.findFirst.mockResolvedValue({ id: "account_1" });
  mockPrisma.instagramAccount.deleteMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/instagram/disconnect", () => {
  it("requires an explicit Instagram account id", async () => {
    const response = await POST(request({}));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe("INSTAGRAM_ACCOUNT_REQUIRED");
    expect(mockPrisma.instagramAccount.deleteMany).not.toHaveBeenCalled();
  });

  it("does not reveal or delete an account from another workspace", async () => {
    mockPrisma.instagramAccount.findFirst.mockResolvedValue(null);

    const response = await POST(request({ instagramAccountId: "foreign_account" }));

    expect(response.status).toBe(404);
    expect(mockPrisma.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign_account", workspaceId: "workspace_1" },
      select: { id: true },
    });
    expect(mockPrisma.instagramAccount.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks cascading deletion when operational or commercial history exists", async () => {
    mockPrisma.instagramAccount.deleteMany.mockResolvedValue({ count: 0 });

    const response = await POST(request({ instagramAccountId: "account_1" }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe("COMMERCIAL_HISTORY_REQUIRES_RETENTION");
    expect(mockPrisma.instagramAccount.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "account_1",
        workspaceId: "workspace_1",
        automations: { none: {} },
        dmLogs: { none: {} },
        leads: { none: {} },
        linkClicks: { none: {} },
        followerSnapshots: { none: {} },
      },
    });
  });

  it("deletes only the selected owned account when no lead exists", async () => {
    const response = await POST(request({ instagramAccountId: "account_1" }));

    expect(response.status).toBe(200);
    expect(mockPrisma.instagramAccount.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "account_1",
        workspaceId: "workspace_1",
        automations: { none: {} },
        dmLogs: { none: {} },
        leads: { none: {} },
        linkClicks: { none: {} },
        followerSnapshots: { none: {} },
      },
    });
  });
});
