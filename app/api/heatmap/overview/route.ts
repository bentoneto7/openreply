import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { buildHeatmapQueue, countByTemperature, isHeatmapPeriod, periodStart } from "@/lib/heatmap/priority";
import { OPEN_LEAD_STATUSES } from "@/lib/crm/lead-status";

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
  const [accounts, logs, leads] = await Promise.all([
    prisma.instagramAccount.findMany({ where: { workspaceId }, orderBy: { connectedAt: "desc" }, select: { id: true, username: true, instagramId: true, name: true } }),
    // DMs recebidas e cliques no botão entram junto: são os sinais de maior
    // intenção que existem hoje, e ficar sem eles subestima o lead quente.
    prisma.dmLog.findMany({
      where: { workspaceId, createdAt: { gte: since }, ...accountFilter },
      orderBy: { createdAt: "desc" }, take: 500,
      include: { automation: { select: { name: true } }, instagramAccount: { select: { username: true } } },
    }),
    prisma.lead.findMany({
      where: { workspaceId, ...accountFilter },
      select: { instagramAccountId: true, commenterId: true, status: true, note: true, lastContactedAt: true },
    }),
  ]);

  const leadByKey = new Map(leads.map((lead) => [`${lead.instagramAccountId}:${lead.commenterId}`, lead]));
  const queue = buildHeatmapQueue(logs).map((item) => {
    const lead = leadByKey.get(item.key);
    return { ...item, leadStatus: lead?.status ?? "NOVO", leadNote: lead?.note ?? null, lastContactedAt: lead?.lastContactedAt?.toISOString() ?? null };
  });
  const uniquePeople = new Set(logs.map((log) => `${log.instagramAccountId}:${log.commenterId}`)).size;
  const comments = logs.filter((log) => !log.commentId.startsWith("dm:") && !log.commentId.startsWith("reveal:"));

  return NextResponse.json({ success: true, data: {
    period, accounts, queue: queue.slice(0, 100), truncated: logs.length === 500,
    // A fila já vem ordenada por score, então o topo dela é exatamente quem
    // mais interagiu.
    topEngaged: queue.slice(0, 12),
    temperatureCounts: countByTemperature(queue),
    metrics: {
      triggeredComments: new Set(comments.map((log) => `${log.instagramAccountId}:${log.commentId}`)).size,
      uniquePeople,
      // Quem já foi trabalhado no CRM sai da fila de espera: o que sobra é o
      // que realmente aguarda alguém.
      awaitingReview: queue.filter((item) => item.leadStatus === "NOVO").length,
      openOpportunities: queue.filter((item) => OPEN_LEAD_STATUSES.includes(item.leadStatus) && item.leadStatus !== "NOVO").length,
      automaticDmsSent: logs.filter((log) => log.status === "SENT").length,
    },
  } }, { headers: { "Cache-Control": "no-store" } });
}
