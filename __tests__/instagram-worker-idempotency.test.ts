import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPrisma,
  mockSendPrivateReply,
  mockSendPrivateReplyWithButton,
  mockSendPrivateReplyWithLinkButton,
  mockSendDirectMessage,
  mockSendDirectMessageWithButton,
  mockSendDirectMessageWithLinkButton,
  mockDecryptToken,
  mockMatchKeywords,
  mockReserveDMSlot,
  mockReserveWorkspaceDMSend,
  mockQueueAdd,
  mockObserveCommercialLead,
} = vi.hoisted(() => ({
  mockPrisma: {
    automation: { findMany: vi.fn(), findFirst: vi.fn() },
    dmLog: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    instagramAccount: { findUnique: vi.fn() },
    operationalEvent: { create: vi.fn() },
  },
  mockSendPrivateReply: vi.fn(),
  mockSendPrivateReplyWithButton: vi.fn(),
  mockSendPrivateReplyWithLinkButton: vi.fn(),
  mockSendDirectMessage: vi.fn(),
  mockSendDirectMessageWithButton: vi.fn(),
  mockSendDirectMessageWithLinkButton: vi.fn(),
  mockDecryptToken: vi.fn(),
  mockMatchKeywords: vi.fn(),
  mockReserveDMSlot: vi.fn(),
  mockReserveWorkspaceDMSend: vi.fn(),
  mockQueueAdd: vi.fn(),
  mockObserveCommercialLead: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/crm/observe-lead", () => ({
  observeCommercialLead: mockObserveCommercialLead,
}));
vi.mock("@/lib/meta/client", () => ({
  sendPrivateReply: mockSendPrivateReply,
  sendPrivateReplyWithButton: mockSendPrivateReplyWithButton,
  sendPrivateReplyWithLinkButton: mockSendPrivateReplyWithLinkButton,
  sendDirectMessage: mockSendDirectMessage,
  sendDirectMessageWithButton: mockSendDirectMessageWithButton,
  sendDirectMessageWithLinkButton: mockSendDirectMessageWithLinkButton,
  sendCommentReply: vi.fn(),
  getUserFollowStatus: vi.fn(),
  MetaApiError: class MetaApiError extends Error {
    constructor(
      public code: number,
      _subcode: number | undefined,
      _trace: string | undefined,
      message: string
    ) {
      super(message);
    }
  },
  TokenExpiredError: class TokenExpiredError extends Error {},
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock("@/lib/meta/oauth", () => ({ decryptToken: mockDecryptToken }));
vi.mock("@/lib/utils/keyword-matcher", () => ({
  matchKeywords: mockMatchKeywords,
}));
vi.mock("@/lib/utils/rate-limiter", () => ({
  reserveDMSlot: mockReserveDMSlot,
}));
vi.mock("@/lib/billing/usage", () => ({
  reserveWorkspaceDMSend: mockReserveWorkspaceDMSend,
  releaseWorkspaceDMReservation: vi.fn(),
}));
vi.mock("@/lib/ops/worker-health", () => ({ recordWorkerAlert: vi.fn() }));
vi.mock("@/lib/queue/client", () => ({
  getDMQueue: () => ({ add: mockQueueAdd }),
  getRedisConnection: vi.fn(),
  POSTBACK_JOB_NAME: "process-postback",
  FOLLOWUP_JOB_NAME: "process-followup",
  MESSAGE_JOB_NAME: "process-message",
}));
vi.mock("bullmq", () => ({
  Worker: function MockWorker(_queue: string, processor: unknown) {
    (globalThis as Record<string, unknown>).__instagramSafetyProcessor =
      processor;
    return { on: vi.fn(), close: vi.fn() };
  },
}));

import { createDMWorker } from "@/lib/queue/dm-worker";

const automation = {
  id: "automation-1",
  workspaceId: "workspace-1",
  instagramAccountId: "account-row-1",
  postId: "media-1",
  keywords: ["PREÇO"],
  dmMessage: "Aqui está o link",
  isActive: true,
  wholeWordMatch: true,
  matchAnyPost: false,
  matchAnyWord: false,
  openingDmEnabled: false,
  openingDmMessage: null,
  openingDmButtonLabel: null,
  linkButtonLabel: null,
  requireFollow: false,
  followPromptMessage: null,
  followPromptButtonLabel: null,
  followUpEnabled: false,
  followUpMessage: null,
  followUpDelayMinutes: 0,
  publicReplyEnabled: false,
  publicReplyMessage: null,
  publicReplyMessages: [],
  instagramAccount: {
    id: "account-row-1",
    instagramId: "ig-professional-1",
    accessToken: "encrypted-token",
  },
  workspace: { id: "workspace-1" },
  trackedLinks: [],
};

const commentJob = {
  id: "comment_ig-professional-1_comment-1",
  name: "process-comment",
  attemptsMade: 2,
  data: {
    instagramAccountId: "ig-professional-1",
    commentId: "comment-1",
    commentText: "PREÇO",
    commenterId: "person-1",
    commenterName: "maria",
    mediaId: "media-1",
    source: "WEBHOOK" as const,
  },
};

function processor() {
  createDMWorker();
  return (globalThis as Record<string, unknown>)
    .__instagramSafetyProcessor as (job: typeof commentJob) => Promise<void>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.automation.findMany.mockResolvedValue([]);
  mockPrisma.automation.findFirst.mockResolvedValue(null);
  mockPrisma.dmLog.findUnique.mockResolvedValue(null);
  mockPrisma.dmLog.findFirst.mockResolvedValue(null);
  mockPrisma.dmLog.create.mockResolvedValue({});
  mockPrisma.dmLog.update.mockResolvedValue({});
  mockPrisma.dmLog.upsert.mockResolvedValue({});
  mockMatchKeywords.mockReturnValue({ matched: true, matchedKeyword: "PREÇO" });
  mockDecryptToken.mockReturnValue("decrypted-token");
  mockObserveCommercialLead.mockResolvedValue({ leadId: "lead-1" });
  mockReserveWorkspaceDMSend.mockResolvedValue({
    allowed: true,
    reserved: true,
    remaining: 10,
    limit: 100,
    periodStart: new Date("2026-09-01T00:00:00.000Z"),
  });
  mockReserveDMSlot.mockResolvedValue({
    allowed: true,
    reserved: true,
    currentCount: 1,
    remainingDMs: 749,
    shouldRequeue: false,
    shouldSkip: false,
    requeueDelayMs: 0,
  });
});

describe("idempotência do worker do Instagram", () => {
  it("não envia quando a consulta não encontra campanha ativa", async () => {
    await processor()(commentJob);

    expect(mockPrisma.automation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(mockSendPrivateReplyWithButton).not.toHaveBeenCalled();
    expect(mockSendPrivateReplyWithLinkButton).not.toHaveBeenCalled();
    expect(mockReserveWorkspaceDMSend).not.toHaveBeenCalled();
  });

  it("não repete a DM quando um retry encontra sucesso já persistido", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([automation]);
    mockPrisma.dmLog.findUnique.mockResolvedValue({
      status: "SENT",
      publicReplySentAt: null,
    });

    await processor()(commentJob);

    expect(mockPrisma.dmLog.findUnique).toHaveBeenCalledWith({
      where: {
        automationId_commentId: {
          automationId: "automation-1",
          commentId: "comment-1",
        },
      },
    });
    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(mockSendPrivateReplyWithButton).not.toHaveBeenCalled();
    expect(mockSendPrivateReplyWithLinkButton).not.toHaveBeenCalled();
    expect(mockReserveDMSlot).not.toHaveBeenCalled();
  });

  it("não envia nem reserva cota quando o ledger comercial está indisponível", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([automation]);
    mockObserveCommercialLead.mockRejectedValueOnce(new Error("commercial ledger unavailable"));

    await expect(processor()(commentJob)).rejects.toThrow("commercial ledger unavailable");

    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(mockSendPrivateReplyWithButton).not.toHaveBeenCalled();
    expect(mockSendPrivateReplyWithLinkButton).not.toHaveBeenCalled();
    expect(mockReserveWorkspaceDMSend).not.toHaveBeenCalled();
    expect(mockReserveDMSlot).not.toHaveBeenCalled();
    expect(mockPrisma.dmLog.create).not.toHaveBeenCalled();
  });
});
