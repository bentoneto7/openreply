export const COMMERCIAL_STATUSES = [
  "NOVO",
  "ABORDADO",
  "RESPONDEU",
  "NEGOCIANDO",
  "GANHO",
  "PERDIDO",
] as const;

export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

export const COMMERCIAL_STATUS_LABEL: Record<CommercialStatus, string> = {
  NOVO: "Novo",
  ABORDADO: "Abordado",
  RESPONDEU: "Respondeu",
  NEGOCIANDO: "Negociando",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

export const INTENT_CATEGORIES = [
  "PRICE",
  "LINK",
  "PURCHASE",
  "QUESTION",
  "OBJECTION",
  "COMPARISON",
  "URGENCY",
  "STRONG_INTEREST",
  "SUPPORT",
  "NO_COMMERCIAL_INTENT",
  "UNKNOWN",
] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];

export const INTENT_LABEL: Record<IntentCategory, string> = {
  PRICE: "Preço",
  LINK: "Link",
  PURCHASE: "Compra",
  QUESTION: "Dúvida",
  OBJECTION: "Objeção",
  COMPARISON: "Comparação",
  URGENCY: "Urgência",
  STRONG_INTEREST: "Interesse forte",
  SUPPORT: "Suporte",
  NO_COMMERCIAL_INTENT: "Sem intenção comercial",
  UNKNOWN: "Não classificada",
};

export interface Opportunity {
  id: string;
  version: number;
  person: { id: string; name: string | null };
  instagramAccount: { id: string; username: string };
  status: CommercialStatus;
  note: string | null;
  assignee: {
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    user: { id: string; name: string | null; email: string | null };
  } | null;
  sourceAutomation: { id: string; name: string } | null;
  origin: {
    type: "COMMENT" | "DIRECT_MESSAGE" | "MANUAL" | null;
    commentId: string | null;
    messageId: string | null;
    postId: string | null;
    keyword: string | null;
    text: string | null;
  };
  commercial: {
    productOffer: string | null;
    potentialValueCents: number | null;
    nextAction: string | null;
    nextActionAt: string | null;
    lossReason: string | null;
  };
  intent: {
    category: IntentCategory | null;
    signals: string[];
    source: "RULE" | "HUMAN" | "AI" | null;
    correctedAt: string | null;
  };
  stages: Record<
    "newAt" | "approachedAt" | "respondedAt" | "negotiatingAt" | "wonAt" | "lostAt",
    string | null
  >;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityDetail extends Opportunity {
  events: Array<{
    id: string;
    type: string;
    fromStatus: CommercialStatus | null;
    toStatus: CommercialStatus | null;
    metadata: unknown;
    occurredAt: string;
    actor: { id: string; user: { id: string; name: string | null } } | null;
  }>;
  sales: Array<{
    id: string;
    status: "CONFIRMED" | "VOIDED";
    amountCents: number;
    currency: string;
    source: "MANUAL" | "API";
    confirmedAt: string;
    voidedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export type MeasurementStatus = "measured" | "partial" | "unavailable";

export interface CommercialResults {
  period: { from: string; to: string; timezone: string };
  coverage: {
    status: MeasurementStatus;
    firstMeasuredAt: string | null;
    reason: string | null;
  };
  metrics: {
    opportunities: { status: MeasurementStatus; value: number | null };
    qualified: { status: MeasurementStatus; value: number | null };
    wins: { status: MeasurementStatus; value: number | null };
    revenue: {
      status: MeasurementStatus;
      confirmedSales: number | null;
      byCurrency: Array<{ currency: string; amountCents: number; confirmedSales: number }> | null;
    };
    conversion: {
      status: MeasurementStatus;
      value: number | null;
      numerator: number | null;
      denominator: number | null;
      reason: string | null;
    };
    pipeline: {
      status: MeasurementStatus;
      stages: Array<{ stage: CommercialStatus; count: number }> | null;
    };
  };
  generatedAt: string;
}
