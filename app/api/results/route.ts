import { NextRequest, NextResponse } from "next/server";
import type { LeadStatus, Prisma } from "@/app/generated/prisma/client";
import { resultsQuerySchema } from "@/lib/crm/contracts";
import { LEAD_STATUSES } from "@/lib/crm/lead-status";
import { getMeasurementStatus } from "@/lib/crm/results";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const QUALIFIED_INTENTS = ["PRICE", "PURCHASE", "URGENCY", "STRONG_INTEREST"] as const;
const MAX_PERIOD_MS = 366 * 24 * 60 * 60 * 1_000;

export async function GET(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  const parsed = resultsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Período ou filtros inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from ? new Date(parsed.data.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1_000);
  if (from >= to || to.getTime() - from.getTime() > MAX_PERIOD_MS) {
    return NextResponse.json(
      { success: false, error: "O período deve ser crescente e ter no máximo 366 dias" },
      { status: 400 }
    );
  }

  const leadScope: Prisma.LeadWhereInput = {
    workspaceId: context.workspaceId,
    ...(parsed.data.instagramAccountId ? { instagramAccountId: parsed.data.instagramAccountId } : {}),
    ...(parsed.data.sourceAutomationId ? { sourceAutomationId: parsed.data.sourceAutomationId } : {}),
  };
  const createdInPeriod: Prisma.LeadWhereInput = {
    ...leadScope,
    newAt: { gte: from, lt: to },
  };
  const confirmedSaleInPeriod: Prisma.SaleWhereInput = {
    workspaceId: context.workspaceId,
    status: "CONFIRMED",
    confirmedAt: { gte: from, lt: to },
  };
  const saleScope: Prisma.SaleWhereInput = {
    ...confirmedSaleInPeriod,
    ...(parsed.data.instagramAccountId || parsed.data.sourceAutomationId
      ? {
          lead: {
            ...(parsed.data.instagramAccountId ? { instagramAccountId: parsed.data.instagramAccountId } : {}),
            ...(parsed.data.sourceAutomationId ? { sourceAutomationId: parsed.data.sourceAutomationId } : {}),
          },
        }
      : {}),
  };

  const [coverage, opportunityCount, qualifiedCount, wonCount, salesByCurrency, stages] = await Promise.all([
    prisma.leadEvent.aggregate({
      where: {
        workspaceId: context.workspaceId,
        ...(parsed.data.instagramAccountId || parsed.data.sourceAutomationId
          ? { lead: leadScope }
          : {}),
      },
      _min: { occurredAt: true },
    }),
    prisma.lead.count({ where: createdInPeriod }),
    prisma.lead.count({
      where: { ...createdInPeriod, intentCategory: { in: [...QUALIFIED_INTENTS] } },
    }),
    prisma.lead.count({
      where: { ...createdInPeriod, sales: { some: confirmedSaleInPeriod } },
    }),
    prisma.sale.groupBy({
      by: ["currency"],
      where: saleScope,
      _count: { _all: true },
      _sum: { amountCents: true },
      orderBy: { currency: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: createdInPeriod,
      _count: { _all: true },
    }),
  ]);

  const firstMeasuredAt = coverage._min.occurredAt;
  const status = getMeasurementStatus(firstMeasuredAt, from, to);
  const hasMeasurement = status !== "unavailable";
  const stageCounts = new Map<LeadStatus, number>(
    stages.map((stage) => [stage.status, stage._count._all])
  );
  const confirmedSales = salesByCurrency.reduce((sum, row) => sum + row._count._all, 0);
  const conversionStatus = !hasMeasurement || opportunityCount === 0 ? "unavailable" : status;

  return NextResponse.json(
    {
      success: true,
      data: {
        period: { from: from.toISOString(), to: to.toISOString(), timezone: "UTC" },
        filters: {
          instagramAccountId: parsed.data.instagramAccountId ?? null,
          sourceAutomationId: parsed.data.sourceAutomationId ?? null,
        },
        coverage: {
          status,
          firstMeasuredAt: firstMeasuredAt?.toISOString() ?? null,
          assumption: "continuous_instrumentation_since_first_commercial_event",
          reason:
            status === "unavailable"
              ? "no_commercial_events_instrumented_before_period_end"
              : status === "partial"
                ? "period_starts_before_first_commercial_event"
                : null,
        },
        methodology: {
          sourceAutomationAttribution: "first_touch",
          saleConfirmation: "manual_operator_action",
        },
        metrics: {
          opportunities: { status, value: hasMeasurement ? opportunityCount : null },
          qualified: {
            status,
            value: hasMeasurement ? qualifiedCount : null,
            definition: {
              basis: "current_intent_category_of_opportunities_created_in_period",
              intentCategories: QUALIFIED_INTENTS,
            },
          },
          wins: {
            status,
            value: hasMeasurement ? wonCount : null,
            definition: "opportunities_created_in_period_with_confirmed_sale_in_period",
          },
          revenue: {
            status,
            confirmedSales: hasMeasurement ? confirmedSales : null,
            byCurrency: hasMeasurement
              ? salesByCurrency.map((row) => ({
                  currency: row.currency.trim(),
                  amountCents: row._sum.amountCents ?? 0,
                  confirmedSales: row._count._all,
                }))
              : null,
            definition: "all_confirmed_sales_in_period; currencies_are_never_summed_together",
          },
          conversion: {
            status: conversionStatus,
            value: conversionStatus === "unavailable" ? null : wonCount / opportunityCount,
            numerator: hasMeasurement ? wonCount : null,
            denominator: hasMeasurement ? opportunityCount : null,
            reason: opportunityCount === 0 && hasMeasurement ? "zero_denominator" : null,
          },
          pipeline: {
            status,
            definition: "current_status_of_opportunities_created_in_period",
            stages: hasMeasurement
              ? LEAD_STATUSES.map((stage) => ({ stage, count: stageCounts.get(stage) ?? 0 }))
              : null,
          },
        },
        generatedAt: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
