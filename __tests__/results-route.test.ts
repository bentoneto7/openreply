import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockAccess, mockPrisma } = vi.hoisted(() => ({
  mockAccess: { getCurrentWorkspaceContext: vi.fn() },
  mockPrisma: {
    leadEvent: { aggregate: vi.fn() },
    lead: { count: vi.fn(), groupBy: vi.fn() },
    sale: { groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/workspace-access", () => mockAccess);

import { GET } from "@/app/api/results/route";

const url =
  "http://localhost/api/results?from=2026-09-01T00:00:00.000Z&to=2026-09-02T00:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.getCurrentWorkspaceContext.mockResolvedValue({
    userId: "user_1",
    workspaceId: "workspace_1",
    role: "MEMBER",
    workspace: { id: "workspace_1" },
  });
  mockPrisma.leadEvent.aggregate.mockResolvedValue({ _min: { occurredAt: null } });
  mockPrisma.lead.count.mockResolvedValue(0);
  mockPrisma.sale.groupBy.mockResolvedValue([]);
  mockPrisma.lead.groupBy.mockResolvedValue([]);
});

describe("results API measurement semantics", () => {
  it("returns null, not a fabricated zero, before measurement exists", async () => {
    const response = await GET(new NextRequest(url));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.coverage.status).toBe("unavailable");
    expect(payload.data.metrics.opportunities.value).toBeNull();
    expect(payload.data.metrics.revenue.byCurrency).toBeNull();
  });

  it("returns an actual zero once the period is demonstrably measured", async () => {
    mockPrisma.leadEvent.aggregate.mockResolvedValue({
      _min: { occurredAt: new Date("2026-08-31T23:00:00.000Z") },
    });

    const response = await GET(new NextRequest(url));
    const payload = await response.json();

    expect(payload.data.coverage.status).toBe("measured");
    expect(payload.data.metrics.opportunities.value).toBe(0);
    expect(payload.data.metrics.revenue.byCurrency).toEqual([]);
    expect(payload.data.metrics.conversion).toMatchObject({
      status: "unavailable",
      value: null,
      denominator: 0,
      reason: "zero_denominator",
    });
  });

  it("scopes every revenue query to the implicit workspace", async () => {
    await GET(new NextRequest(`${url}&sourceAutomationId=automation_1`));

    expect(mockPrisma.sale.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace_1",
          status: "CONFIRMED",
          lead: expect.objectContaining({ sourceAutomationId: "automation_1" }),
        }),
      })
    );
  });

  it("keeps wins in the opportunity cohort while revenue remains a period flow", async () => {
    await GET(new NextRequest(url));

    const winsQuery = mockPrisma.lead.count.mock.calls[2][0];
    expect(winsQuery.where).toMatchObject({
      workspaceId: "workspace_1",
      newAt: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lt: new Date("2026-09-02T00:00:00.000Z"),
      },
      sales: {
        some: {
          workspaceId: "workspace_1",
          status: "CONFIRMED",
          confirmedAt: {
            gte: new Date("2026-09-01T00:00:00.000Z"),
            lt: new Date("2026-09-02T00:00:00.000Z"),
          },
        },
      },
    });
    expect(mockPrisma.sale.groupBy.mock.calls[0][0].where).not.toHaveProperty("newAt");
  });
});
