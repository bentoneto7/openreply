import { Prisma, type LeadOriginType } from "@/app/generated/prisma/client";
import { classifyLeadIntent } from "@/lib/crm/intent";
import { sanitizeEventMetadata } from "@/lib/crm/event-metadata";
import { prisma } from "@/lib/db/client";

export type CommercialObservation = {
  workspaceId: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName?: string | null;
  sourceAutomationId: string;
  originType: Exclude<LeadOriginType, "MANUAL">;
  originCommentId?: string | null;
  originMessageId?: string | null;
  originPostId?: string | null;
  originKeyword?: string | null;
  originText: string;
  sourceEventKey: string;
};

function bounded(value: string | null | undefined, max: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function observeCommercialLead(input: CommercialObservation) {
  const originText = input.originText.slice(0, 2_000);
  const originKeyword = bounded(input.originKeyword, 200);
  const commenterName = bounded(input.commenterName, 200);
  const intent = classifyLeadIntent(originText, originKeyword);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const [account, automation] = await Promise.all([
      tx.instagramAccount.findFirst({
        where: { id: input.instagramAccountId, workspaceId: input.workspaceId },
        select: { id: true },
      }),
      tx.automation.findFirst({
        where: {
          id: input.sourceAutomationId,
          workspaceId: input.workspaceId,
          instagramAccountId: input.instagramAccountId,
        },
        select: { id: true },
      }),
    ]);
    if (!account || !automation) {
      throw new Error("Commercial observation references a resource outside its workspace");
    }

    const existingEvent = await tx.leadEvent.findUnique({
      where: {
        workspaceId_sourceEventKey: {
          workspaceId: input.workspaceId,
          sourceEventKey: input.sourceEventKey,
        },
      },
      select: { leadId: true },
    });
    if (existingEvent) {
      return { leadId: existingEvent.leadId, intent };
    }

    const lead = await tx.lead.upsert({
      where: {
        instagramAccountId_commenterId: {
          instagramAccountId: input.instagramAccountId,
          commenterId: input.commenterId,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        instagramAccountId: input.instagramAccountId,
        commenterId: input.commenterId,
        commenterName,
        sourceAutomationId: input.sourceAutomationId,
        sourceAutomationWorkspaceId: input.workspaceId,
        originType: input.originType,
        originCommentId: bounded(input.originCommentId, 191),
        originMessageId: bounded(input.originMessageId, 191),
        originPostId: bounded(input.originPostId, 191),
        originKeyword,
        originText,
        newAt: now,
        intentCategory: intent.category,
        intentSignals: intent.signals,
        intentSource: intent.source,
      },
      update: commenterName ? { commenterName } : {},
      select: {
        id: true,
        originType: true,
        sourceAutomationId: true,
        intentSource: true,
      },
    });

    if (!lead.originType) {
      await tx.lead.updateMany({
        where: { id: lead.id, workspaceId: input.workspaceId, originType: null },
        data: {
          originType: input.originType,
          originCommentId: bounded(input.originCommentId, 191),
          originMessageId: bounded(input.originMessageId, 191),
          originPostId: bounded(input.originPostId, 191),
          originKeyword,
          originText,
          newAt: now,
        },
      });
    }
    if (!lead.sourceAutomationId) {
      await tx.lead.updateMany({
        where: { id: lead.id, workspaceId: input.workspaceId, sourceAutomationId: null },
        data: {
          sourceAutomationId: input.sourceAutomationId,
          sourceAutomationWorkspaceId: input.workspaceId,
        },
      });
    }
    if (lead.intentSource !== "HUMAN") {
      await tx.lead.updateMany({
        where: { id: lead.id, workspaceId: input.workspaceId, intentSource: { not: "HUMAN" } },
        data: {
          intentCategory: intent.category,
          intentSignals: intent.signals,
          intentSource: intent.source,
        },
      });
    }

    await tx.leadEvent.createMany({
      data: [
        {
          workspaceId: input.workspaceId,
          leadId: lead.id,
          type: input.originType === "COMMENT" ? "OBSERVED_COMMENT" : "OBSERVED_DM",
          sourceEventKey: input.sourceEventKey,
          metadata: sanitizeEventMetadata({
            sourceAutomationId: input.sourceAutomationId,
            originPostId: bounded(input.originPostId, 191),
            originKeyword,
            intentCategory: intent.category,
            intentSignals: intent.signals,
          }) as Prisma.InputJsonValue,
          occurredAt: now,
        },
      ],
      skipDuplicates: true,
    });

    return { leadId: lead.id, intent };
  });
}
