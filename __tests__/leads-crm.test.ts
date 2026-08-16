import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAuth } = vi.hoisted(() => ({
  mockPrisma: {
    instagramAccount: { findFirst: vi.fn() },
    lead: { upsert: vi.fn() },
  },
  mockAuth: { getCurrentWorkspaceId: vi.fn() },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => mockAuth);

import { PATCH } from "@/app/api/leads/route";

// A rota só usa request.json(), então um objeto com esse método basta.
const request = (body: unknown) => ({ json: async () => body }) as never;

const validBody = { instagramAccountId: "account_1", commenterId: "person_1", status: "ABORDADO" };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getCurrentWorkspaceId.mockResolvedValue("workspace_1");
  mockPrisma.instagramAccount.findFirst.mockResolvedValue({ id: "account_1" });
  mockPrisma.lead.upsert.mockImplementation(async (args: { create: unknown }) => args.create);
});

describe("PATCH /api/leads", () => {
  it("refuses an unauthenticated caller", async () => {
    mockAuth.getCurrentWorkspaceId.mockResolvedValue(null);
    const response = await PATCH(request(validBody));
    expect(response.status).toBe(401);
    expect(mockPrisma.lead.upsert).not.toHaveBeenCalled();
  });

  it("refuses to write a lead on an account from another workspace", async () => {
    // Sem conta no workspace atual, o par (conta, comentarista) não é nosso.
    mockPrisma.instagramAccount.findFirst.mockResolvedValue(null);
    const response = await PATCH(request(validBody));
    expect(response.status).toBe(404);
    expect(mockPrisma.lead.upsert).not.toHaveBeenCalled();
  });

  it("always scopes the account lookup to the caller's workspace", async () => {
    await PATCH(request(validBody));
    expect(mockPrisma.instagramAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "account_1", workspaceId: "workspace_1" } })
    );
  });

  it("rejects an unknown status instead of writing it", async () => {
    const response = await PATCH(request({ ...validBody, status: "GANHOU_TALVEZ" }));
    expect(response.status).toBe(400);
    expect(mockPrisma.lead.upsert).not.toHaveBeenCalled();
  });

  it("stamps the contact date when the lead leaves the not-contacted state", async () => {
    await PATCH(request(validBody));
    const args = mockPrisma.lead.upsert.mock.calls[0][0];
    expect(args.create.lastContactedAt).toBeInstanceOf(Date);
    expect(args.update.lastContactedAt).toBeInstanceOf(Date);
    expect(args.where).toEqual({ instagramAccountId_commenterId: { instagramAccountId: "account_1", commenterId: "person_1" } });
  });

  it("does not stamp a contact date when the lead is moved back to NOVO", async () => {
    await PATCH(request({ ...validBody, status: "NOVO" }));
    const args = mockPrisma.lead.upsert.mock.calls[0][0];
    expect(args.create.lastContactedAt).toBeUndefined();
    expect(args.update.lastContactedAt).toBeUndefined();
  });

  it("leaves an existing note untouched when the caller omits it", async () => {
    await PATCH(request(validBody));
    const args = mockPrisma.lead.upsert.mock.calls[0][0];
    expect(args.update).not.toHaveProperty("note");
  });
});
