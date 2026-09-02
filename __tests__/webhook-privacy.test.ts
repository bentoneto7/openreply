import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockWebhook } = vi.hoisted(() => ({
  mockPrisma: {
    operationalEvent: { create: vi.fn() },
  },
  mockWebhook: {
    verifyWebhookSignature: vi.fn(),
    parseCommentEvents: vi.fn(),
    parseMessageEvents: vi.fn(),
    parsePostbackEvents: vi.fn(),
    parseReadEvents: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/meta/webhook", () => mockWebhook);
vi.mock("@/lib/queue/client", () => ({
  getDMQueue: vi.fn(),
  MESSAGE_JOB_NAME: "process-message",
  POSTBACK_JOB_NAME: "process-postback",
}));

import { POST } from "@/app/api/webhook/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockWebhook.verifyWebhookSignature.mockReturnValue(false);
  mockPrisma.operationalEvent.create.mockResolvedValue({ id: "event_1" });
});

describe("POST /api/webhook privacy", () => {
  it("não persiste prévia de payload rejeitado por assinatura", async () => {
    const privatePayload = JSON.stringify({
      email: "pessoa@example.com",
      access_token: "IGAA-segredo",
      message: "conteúdo privado",
    });
    const response = await POST(
      new NextRequest("http://localhost/api/webhook", {
        method: "POST",
        headers: { "x-hub-signature-256": "sha256=invalid" },
        body: privatePayload,
      })
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.operationalEvent.create).toHaveBeenCalledWith({
      data: {
        source: "SYSTEM",
        level: "WARNING",
        message: "Webhook signature verification failed",
        payload: {
          hadSignatureHeader: true,
          bodyLength: privatePayload.length,
        },
      },
    });
    expect(
      JSON.stringify(mockPrisma.operationalEvent.create.mock.calls)
    ).not.toContain("IGAA-segredo");
    expect(
      JSON.stringify(mockPrisma.operationalEvent.create.mock.calls)
    ).not.toContain("pessoa@example.com");
  });
});
