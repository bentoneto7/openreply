import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockPrisma,
  mockQueue,
  mockWebhook,
  mockMeta,
  mockDecryptToken,
} = vi.hoisted(() => ({
  mockPrisma: {
    operationalEvent: { create: vi.fn() },
    webhookEvent: { create: vi.fn(), update: vi.fn() },
    instagramAccount: { findUnique: vi.fn() },
    automation: { findMany: vi.fn() },
    dmLog: { findMany: vi.fn() },
  },
  mockQueue: { add: vi.fn() },
  mockWebhook: {
    verifyWebhookSignature: vi.fn(),
    parseCommentEvents: vi.fn(),
    parseMessageEvents: vi.fn(),
    parsePostbackEvents: vi.fn(),
    parseReadEvents: vi.fn(),
  },
  mockMeta: {
    getRecentMediaComments: vi.fn(),
    getUserMedia: vi.fn(),
  },
  mockDecryptToken: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/meta/webhook", () => mockWebhook);
vi.mock("@/lib/queue/client", () => ({
  getDMQueue: () => mockQueue,
  MESSAGE_JOB_NAME: "process-message",
  POSTBACK_JOB_NAME: "process-postback",
}));
vi.mock("@/lib/meta/client", () => ({
  ...mockMeta,
  MetaApiError: class MetaApiError extends Error {
    constructor(public code: number, message: string) {
      super(message);
    }
  },
}));
vi.mock("@/lib/meta/oauth", () => ({ decryptToken: mockDecryptToken }));
vi.mock("@/lib/utils/keyword-matcher", () => ({
  matchKeywords: vi.fn(() => ({ matched: false, matchedKeyword: null })),
}));

import { POST } from "@/app/api/webhook/route";
import { reconcileComments } from "@/lib/polling/comment-reconciler";

const validComment = {
  instagramAccountId: "ig-professional-1",
  commentId: "comment-1",
  commentText: "PREÇO",
  commenterId: "person-1",
  commenterName: "maria",
  mediaId: "media-1",
};

function webhookRequest(body: string, signature = "sha256=test") {
  return new NextRequest("http://localhost/api/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.operationalEvent.create.mockResolvedValue({ id: "warning-1" });
  mockPrisma.webhookEvent.create
    .mockResolvedValueOnce({ id: "webhook-1" })
    .mockResolvedValueOnce({ id: "webhook-2" });
  mockPrisma.webhookEvent.update.mockResolvedValue({});
  mockPrisma.instagramAccount.findUnique.mockResolvedValue({
    workspaceId: "workspace-1",
  });
  mockPrisma.automation.findMany.mockResolvedValue([]);
  mockPrisma.dmLog.findMany.mockResolvedValue([]);
  mockQueue.add.mockResolvedValue({ id: "job-1" });
  mockWebhook.verifyWebhookSignature.mockReturnValue(true);
  mockWebhook.parseCommentEvents.mockReturnValue([]);
  mockWebhook.parseMessageEvents.mockReturnValue([]);
  mockWebhook.parsePostbackEvents.mockReturnValue([]);
  mockWebhook.parseReadEvents.mockReturnValue([]);
});

describe("segurança do webhook do Instagram", () => {
  it("rejeita assinatura inválida antes de persistir evento ou enfileirar trabalho", async () => {
    const rejectedBody = JSON.stringify({
      access_token: "IGAA-nao-deve-ser-persistido",
      message: "mensagem privada",
    });
    mockWebhook.verifyWebhookSignature.mockReturnValue(false);

    const response = await POST(webhookRequest(rejectedBody, "sha256=invalid"));

    expect(response.status).toBe(401);
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.webhookEvent.update).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
    expect(mockPrisma.operationalEvent.create).toHaveBeenCalledOnce();

    const recorded = JSON.stringify(
      mockPrisma.operationalEvent.create.mock.calls[0]
    );
    expect(recorded).not.toContain("IGAA-nao-deve-ser-persistido");
    expect(recorded).not.toContain("mensagem privada");
  });

  it("produz a mesma chave BullMQ para a mesma entrega de comentário", async () => {
    mockWebhook.parseCommentEvents.mockReturnValue([validComment]);
    const body = JSON.stringify({ object: "instagram", entry: [] });

    const first = await POST(webhookRequest(body));
    const second = await POST(webhookRequest(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockQueue.add).toHaveBeenCalledTimes(2);
    expect(mockQueue.add.mock.calls[0][2]).toEqual({
      jobId: "comment_ig-professional-1_comment-1",
    });
    expect(mockQueue.add.mock.calls[1][2]).toEqual(
      mockQueue.add.mock.calls[0][2]
    );
  });
});

describe("reconciliação segura", () => {
  it("não consulta a Meta nem enfileira quando não há campanha ativa", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([]);

    await reconcileComments();

    expect(mockPrisma.automation.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: expect.any(Object),
    });
    expect(mockMeta.getUserMedia).not.toHaveBeenCalled();
    expect(mockMeta.getRecentMediaComments).not.toHaveBeenCalled();
    expect(mockDecryptToken).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });
});
