import { Prisma } from "@/app/generated/prisma/client";

const opportunityBaseSelect = {
  id: true,
  commenterId: true,
  commenterName: true,
  status: true,
  note: true,
  productOffer: true,
  potentialValueCents: true,
  nextAction: true,
  nextActionAt: true,
  lossReason: true,
  lastContactedAt: true,
  newAt: true,
  approachedAt: true,
  respondedAt: true,
  negotiatingAt: true,
  wonAt: true,
  lostAt: true,
  intentCategory: true,
  intentSignals: true,
  intentSource: true,
  intentCorrectedAt: true,
  originType: true,
  originCommentId: true,
  originMessageId: true,
  originPostId: true,
  originKeyword: true,
  originText: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  instagramAccount: { select: { id: true, username: true } },
  assignee: {
    select: {
      id: true,
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  sourceAutomation: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

export const opportunityListSelect = opportunityBaseSelect;

export const opportunityDetailSelect = {
  ...opportunityBaseSelect,
  events: {
    orderBy: [{ occurredAt: "desc" as const }, { id: "desc" as const }],
    take: 100,
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      metadata: true,
      occurredAt: true,
      actor: {
        select: {
          id: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  },
  sales: {
    orderBy: [{ confirmedAt: "desc" as const }, { id: "desc" as const }],
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      source: true,
      confirmedAt: true,
      voidedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.LeadSelect;

type OpportunityListRow = Prisma.LeadGetPayload<{ select: typeof opportunityListSelect }>;
type OpportunityDetailRow = Prisma.LeadGetPayload<{ select: typeof opportunityDetailSelect }>;

function baseDto(row: OpportunityListRow) {
  return {
    id: row.id,
    version: row.version,
    person: { id: row.commenterId, name: row.commenterName },
    instagramAccount: row.instagramAccount,
    status: row.status,
    note: row.note,
    assignee: row.assignee,
    sourceAutomation: row.sourceAutomation,
    origin: {
      type: row.originType,
      commentId: row.originCommentId,
      messageId: row.originMessageId,
      postId: row.originPostId,
      keyword: row.originKeyword,
      text: row.originText,
    },
    commercial: {
      productOffer: row.productOffer,
      potentialValueCents: row.potentialValueCents,
      nextAction: row.nextAction,
      nextActionAt: row.nextActionAt,
      lossReason: row.lossReason,
    },
    intent: {
      category: row.intentCategory,
      signals: row.intentSignals,
      source: row.intentSource,
      correctedAt: row.intentCorrectedAt,
    },
    stages: {
      newAt: row.newAt,
      approachedAt: row.approachedAt,
      respondedAt: row.respondedAt,
      negotiatingAt: row.negotiatingAt,
      wonAt: row.wonAt,
      lostAt: row.lostAt,
    },
    lastContactedAt: row.lastContactedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toOpportunityListDto(row: OpportunityListRow) {
  return baseDto(row);
}

export function toOpportunityDetailDto(row: OpportunityDetailRow) {
  return {
    ...baseDto(row),
    events: row.events,
    sales: row.sales,
  };
}
