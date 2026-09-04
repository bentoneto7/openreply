import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/crm/lead-status";

export const LEAD_INTENT_CATEGORIES = [
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

export const OPPORTUNITY_LIST_LIMIT = 25;
export const OPPORTUNITY_LIST_MAX_LIMIT = 100;

/**
 * Ordens da fila de oportunidades. `recent` é a ordem de trabalho (quem mudou
 * por último), `engagement` é a ordem de prioridade comercial: do mais engajado
 * para o menos engajado dentro da janela de 7 dias. Ver
 * `lib/crm/opportunity-engagement.ts`.
 */
export const OPPORTUNITY_SORTS = ["recent", "engagement"] as const;

export type OpportunitySort = (typeof OPPORTUNITY_SORTS)[number];
const MAX_MONEY_CENTS = 2_000_000_000;

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const nullableDateTime = z.string().datetime({ offset: true }).nullable().optional();

const saleSchema = z
  .object({
    amountCents: z.number().int().min(1).max(MAX_MONEY_CENTS),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase()),
  })
  .strict();

export const opportunityPatchSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
    status: z.enum(LEAD_STATUSES).optional(),
    note: nullableText(2_000),
    assigneeMemberId: z.string().min(1).max(191).nullable().optional(),
    productOffer: nullableText(500),
    potentialValueCents: z.number().int().min(0).max(MAX_MONEY_CENTS).nullable().optional(),
    nextAction: nullableText(500),
    nextActionAt: nullableDateTime,
    lossReason: nullableText(1_000),
    intentCategory: z.enum(LEAD_INTENT_CATEGORIES).optional(),
    sale: saleSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => key !== "expectedVersion" && key !== "idempotencyKey"
      ),
    { message: "Nenhuma alteração foi informada" }
  );

export const opportunityListQuerySchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    instagramAccountId: z.string().min(1).max(191).optional(),
    commenterId: z.string().min(1).max(191).optional(),
    assigneeMemberId: z.string().min(1).max(191).optional(),
    intentCategory: z.enum(LEAD_INTENT_CATEGORIES).optional(),
    sourceAutomationId: z.string().min(1).max(191).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    sort: z.enum(OPPORTUNITY_SORTS).default("recent"),
    cursor: z.string().max(1_000).optional(),
    limit: z.coerce.number().int().min(1).max(OPPORTUNITY_LIST_MAX_LIMIT).default(OPPORTUNITY_LIST_LIMIT),
  })
  .strict();

export const resultsQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    instagramAccountId: z.string().min(1).max(191).optional(),
    sourceAutomationId: z.string().min(1).max(191).optional(),
  })
  .strict();

export type OpportunityPatchInput = z.infer<typeof opportunityPatchSchema>;
