import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { buildHeatmapQueue, countByTemperature, isHeatmapPeriod, periodStart } from "@/lib/heatmap/priority";
import { IN_PROGRESS_LEAD_STATUSES } from "@/lib/crm/lead-status";
import { intentCommentFilter, SIGNAL_PREFIXES } from "@/lib/tracking/analytics";

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
  const window = { workspaceId, createdAt: { gte: since }, ...accountFilter };
  const include = { automation: { select: { name: true } }, instagramAccount: { select: { username: true } } };

  // Comentários e sinais de DM têm janelas separadas de propósito. Numa única
  // query com take: 500, uma conta com muitas DMs empurraria os comentários
  // para fora da amostra e derrubaria "Comentários acionados" sem aviso.
  const [accounts, comments, dmSignals] = await Promise.all([
    prisma.instagramAccount.findMany({ where: { workspaceId }, orderBy: { connectedAt: "desc" }, select: { id: true, username: true, instagramId: true, name: true } }),
    prisma.dmLog.findMany({
      where: { ...window, ...intentCommentFilter },
      orderBy: { createdAt: "desc" }, take: 500, include,
    }),
    prisma.dmLog.findMany({
      where: { ...window, OR: SIGNAL_PREFIXES.map((prefix) => ({ commentId: { startsWith: prefix } })) },
      orderBy: { createdAt: "desc" }, take: 500, include,
    }),
  ]);

  const logs = [...comments, ...dmSignals];
  const queue = buildHeatmapQueue(logs);

  // Só os leads de quem está na fila: buscar o workspace inteiro cresceria sem
  // teto conforme o CRM é usado.
  const leads = queue.length === 0 ? [] : await prisma.lead.findMany({
    where: { workspaceId, commenterId: { in: [...new Set(queue.map((item) => item.commenterId))] } },
    select: { instagramAccountId: true, commenterId: true, status: true, note: true, lastContactedAt: true },
  });
  const leadByKey = new Map(leads.map((lead) => [`${lead.instagramAccountId}:${lead.commenterId}`, lead]));
  const withLeads = queue.map((item) => {
    const lead = leadByKey.get(item.key);
    return { ...item, leadStatus: lead?.status ?? "NOVO", leadNote: lead?.note ?? null, lastContactedAt: lead?.lastContactedAt?.toISOString() ?? null };
  });

  // O pipeline não é recortado pelo período: um lead em negociação há quatro
  // meses continua em negociação hoje, mesmo sem sinal novo.
  const openOpportunities = await prisma.lead.count({
    where: { workspaceId, ...accountFilter, status: { in: IN_PROGRESS_LEAD_STATUSES } },
  });

  // Contagens e lista saem do mesmo recorte: um chip dizendo "47 pessoas" ao
  // lado de uma lista que só consegue mostrar parte delas é um número que a
  // própria tela desmente.
  const visible = withLeads.slice(0, 100);

  return NextResponse.json({ success: true, data: {
    period, accounts,
    queue: visible,
    truncated: comments.length === 500 || dmSignals.length === 500 || withLeads.length > visible.length,
    temperatureCounts: countByTemperature(visible),
    metrics: {
      triggeredComments: new Set(comments.map((log) => `${log.instagramAccountId}:${log.commentId}`)).size,
      uniquePeople: new Set(logs.map((log) => `${log.instagramAccountId}:${log.commenterId}`)).size,
      // Quem já foi trabalhado no CRM sai da fila de espera: o que sobra é o
      // que realmente aguarda alguém.
      awaitingReview: visible.filter((item) => item.leadStatus === "NOVO").length,
      openOpportunities,
      automaticDmsSent: logs.filter((log) => log.status === "SENT").length,
    },
  } }, { headers: { "Cache-Control": "no-store" } });
}
