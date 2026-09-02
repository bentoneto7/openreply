import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOT_INTENTS = ["PRICE", "PURCHASE", "URGENCY", "STRONG_INTEREST"] as const;

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const now = new Date();
  const stalledBefore = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const openWhere: Prisma.LeadWhereInput = {
    workspaceId: context.workspaceId,
    status: { notIn: ["GANHO", "PERDIDO"] },
  };

  const [totalOpen, newLeads, unassigned, overdue, stalled, hot] =
    await Promise.all([
      prisma.lead.count({ where: openWhere }),
      prisma.lead.count({
        where: { workspaceId: context.workspaceId, status: "NOVO" },
      }),
      prisma.lead.count({
        where: { ...openWhere, assigneeMemberId: null },
      }),
      prisma.lead.count({
        where: { ...openWhere, nextActionAt: { lt: now } },
      }),
      prisma.lead.count({
        where: {
          workspaceId: context.workspaceId,
          status: "NEGOCIANDO",
          updatedAt: { lt: stalledBefore },
        },
      }),
      prisma.lead.count({
        where: {
          ...openWhere,
          intentCategory: { in: [...HOT_INTENTS] },
        },
      }),
    ]);

  return NextResponse.json(
    {
      success: true,
      data: {
        counts: { totalOpen, newLeads, unassigned, overdue, stalled, hot },
        coverage: "exact",
        generatedAt: now.toISOString(),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
