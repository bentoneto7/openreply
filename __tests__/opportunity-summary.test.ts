import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAccess, mockPrisma } = vi.hoisted(() => ({
  mockAccess: { getCurrentWorkspaceContext: vi.fn() },
  mockPrisma: { lead: { count: vi.fn() } },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/workspace-access", () => mockAccess);

import { GET } from "@/app/api/opportunities/summary/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.getCurrentWorkspaceContext.mockResolvedValue({
    userId: "user_1",
    workspaceId: "workspace_1",
    workspace: { id: "workspace_1" },
    role: "MEMBER",
  });
  mockPrisma.lead.count
    .mockResolvedValueOnce(21)
    .mockResolvedValueOnce(8)
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(3)
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(7);
});

describe("opportunity summary", () => {
  it("returns exact workspace-scoped counts instead of a paginated sample", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      counts: {
        totalOpen: 21,
        newLeads: 8,
        unassigned: 5,
        overdue: 3,
        stalled: 2,
        hot: 7,
      },
      coverage: "exact",
    });
    expect(mockPrisma.lead.count).toHaveBeenCalledTimes(6);
    for (const [query] of mockPrisma.lead.count.mock.calls) {
      expect(query.where.workspaceId).toBe("workspace_1");
    }
  });

  it("does not expose aggregate counts without a workspace session", async () => {
    mockAccess.getCurrentWorkspaceContext.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockPrisma.lead.count).not.toHaveBeenCalled();
  });
});
