import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockQueue, mockOps, mockWorkspaceAccess } = vi.hoisted(
  () => ({
    mockPrisma: {
      webhookEvent: { findMany: vi.fn() },
      dmLog: { findMany: vi.fn() },
      operationalEvent: { findMany: vi.fn() },
      instagramAccount: { findMany: vi.fn() },
    },
    mockQueue: { getJobCounts: vi.fn() },
    mockOps: {
      getWorkerHealth: vi.fn(),
      getWorkerAlerts: vi.fn(),
    },
    mockWorkspaceAccess: {
      getCurrentWorkspaceContext: vi.fn(),
      canManageWorkspace: vi.fn(
        (role: string) => role === "OWNER" || role === "ADMIN"
      ),
    },
  })
);

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue/client", () => ({
  getDMQueue: () => mockQueue,
}));
vi.mock("@/lib/ops/worker-health", () => mockOps);
vi.mock("@/lib/workspace-access", () => mockWorkspaceAccess);

import { GET } from "@/app/api/admin/diagnostics/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockQueue.getJobCounts.mockResolvedValue({
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
  });
  mockOps.getWorkerHealth.mockResolvedValue({
    healthy: true,
    heartbeat: null,
    ageMs: 0,
  });
  mockOps.getWorkerAlerts.mockResolvedValue([]);
  mockPrisma.webhookEvent.findMany.mockResolvedValue([]);
  mockPrisma.dmLog.findMany.mockResolvedValue([]);
  mockPrisma.operationalEvent.findMany.mockResolvedValue([]);
  mockPrisma.instagramAccount.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/diagnostics", () => {
  it("bloqueia MEMBER antes de consultar dados operacionais", async () => {
    mockWorkspaceAccess.getCurrentWorkspaceContext.mockResolvedValue({
      userId: "user_member",
      workspaceId: "workspace_1",
      role: "MEMBER",
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mockQueue.getJobCounts).not.toHaveBeenCalled();
    expect(mockPrisma.operationalEvent.findMany).not.toHaveBeenCalled();
  });

  it("isola eventos e alertas do administrador pelo workspace", async () => {
    mockWorkspaceAccess.getCurrentWorkspaceContext.mockResolvedValue({
      userId: "user_admin",
      workspaceId: "workspace_1",
      role: "ADMIN",
    });
    mockPrisma.instagramAccount.findMany.mockResolvedValue([
      { instagramId: "instagram_own" },
    ]);
    mockOps.getWorkerAlerts.mockResolvedValue([
      {
        level: "error",
        message: "falha própria",
        instagramAccountId: "instagram_own",
        createdAt: "2026-09-02T00:00:00.000Z",
      },
      {
        level: "error",
        message: "falha de outro workspace",
        instagramAccountId: "instagram_foreign",
        createdAt: "2026-09-02T00:00:00.000Z",
      },
      {
        level: "error",
        message: "falha sem proprietário verificável",
        createdAt: "2026-09-02T00:00:00.000Z",
      },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockQueue.getJobCounts).not.toHaveBeenCalled();
    expect(payload.data.queueCounts).toBeNull();
    expect(payload.data.queueCountsReason).toBe(
      "queue_telemetry_not_partitioned_by_workspace"
    );
    expect(mockOps.getWorkerAlerts).toHaveBeenCalledWith(25);
    expect(payload.data.workerAlerts).toEqual([
      expect.objectContaining({
        message: "falha própria",
        instagramAccountId: "instagram_own",
      }),
    ]);
    for (const [query] of mockPrisma.operationalEvent.findMany.mock.calls) {
      expect(query.where).toEqual({
        workspaceId: "workspace_1",
        ...(query.where.source ? { source: query.where.source } : {}),
        ...(query.where.level ? { level: query.where.level } : {}),
      });
      expect(query.where).not.toHaveProperty("OR");
    }
  });
});
