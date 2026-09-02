import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockWorkspaceAccess } = vi.hoisted(() => ({
  mockPrisma: {
    workspaceMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    workspaceInvitation: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  mockWorkspaceAccess: {
    getCurrentWorkspaceContext: vi.fn(),
    canManageWorkspace: vi.fn((role: string) => role === "OWNER" || role === "ADMIN"),
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/workspace-access", () => mockWorkspaceAccess);

import { GET, POST } from "@/app/api/workspace/members/route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/workspace/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.workspaceMember.findMany.mockResolvedValue([]);
  mockPrisma.workspaceInvitation.findMany.mockResolvedValue([
    {
      id: "invite_1",
      email: "pessoa@example.com",
      role: "MEMBER",
      token: "segredo-do-convite",
      expiresAt: new Date("2026-09-03T00:00:00.000Z"),
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
    },
  ]);
});

describe("GET /api/workspace/members", () => {
  it("não consulta nem expõe convites pendentes para MEMBER", async () => {
    mockWorkspaceAccess.getCurrentWorkspaceContext.mockResolvedValue({
      userId: "user_1",
      workspaceId: "workspace_1",
      role: "MEMBER",
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockPrisma.workspaceInvitation.findMany).not.toHaveBeenCalled();
    expect(payload.data.invitations).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain("segredo-do-convite");
  });

  it("mantém os links de convite disponíveis para administradores", async () => {
    mockWorkspaceAccess.getCurrentWorkspaceContext.mockResolvedValue({
      userId: "user_admin",
      workspaceId: "workspace_1",
      role: "ADMIN",
    });

    const response = await GET();
    const payload = await response.json();

    expect(mockPrisma.workspaceInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace_1", status: "PENDING" },
      })
    );
    expect(payload.data.invitations[0].inviteUrl).toContain(
      "/invite/segredo-do-convite"
    );
    expect(payload.data.invitations[0]).not.toHaveProperty("token");
  });

  it("não permite que um novo convite rebaixe o proprietário", async () => {
    mockWorkspaceAccess.getCurrentWorkspaceContext.mockResolvedValue({
      userId: "user_admin",
      workspaceId: "workspace_1",
      role: "ADMIN",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user_owner" });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: "OWNER" });

    const response = await POST(
      postRequest({ email: "owner@example.com", role: "MEMBER" })
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace_1",
          userId: "user_owner",
        },
      },
      select: { role: true },
    });
    expect(mockPrisma.workspaceMember.upsert).not.toHaveBeenCalled();
  });
});
