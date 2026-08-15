import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { buildHeatmapQueue, isHeatmapPeriod, periodStart } from "@/lib/heatmap/priority";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

  const rawPeriod = request.nextUrl.searchParams.get("period");
  const period = isHeatmapPeriod(rawPeriod) ? rawPeriod : "7d";
  const requestedAccountId = request.nextUrl.searchParams.get("instagramAccountId");
  const account = requestedAccountId && requestedAccountId !== "all"
    ? await prisma.instagramAccount.findFirst({ where: { id: requestedAccountId, workspaceId }, select: { id: true } })
    : null;
  if (requestedAccountId && requestedAccountId !== "all" && !account) {
    return NextResponse.json({ success: false, error: "Conta não encontrada" }, { status: 404 });
  }

  const accountFilter = account ? { instagramAccountId: account.id } : {};
  const since = periodStart(period);
  const [accounts, logs] = await Promise.all([
    prisma.instagramAccount.findMany({ where: { workspaceId }, orderBy: { connectedAt: "desc" }, select: { id: true, username: true, instagramId: true, name: true } }),
    prisma.dmLog.findMany({
      where: { workspaceId, createdAt: { gte: since }, commentId: { not: { startsWith: "dm:" } }, ...accountFilter },
      orderBy: { createdAt: "desc" }, take: 500,
      include: { automation: { select: { name: true } }, instagramAccount: { select: { username: true } } },
    }),
  ]);
  const queue = buildHeatmapQueue(logs);
  const uniquePeople = new Set(logs.map((log) => `${log.instagramAccountId}:${log.commenterId}`)).size;

  return NextResponse.json({ success: true, data: {
    period, accounts, queue: queue.slice(0, 100), truncated: logs.length === 500,
    metrics: {
      triggeredComments: new Set(logs.map((log) => `${log.instagramAccountId}:${log.commentId}`)).size,
      uniquePeople,
      awaitingReview: uniquePeople,
      automaticDmsSent: logs.filter((log) => log.status === "SENT").length,
    },
  } }, { headers: { "Cache-Control": "no-store" } });
}
