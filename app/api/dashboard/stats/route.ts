import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { calculateCtr, normalizeTopKeywords, summarizeDmStatuses } from "@/lib/tracking/analytics";

export const dynamic = "force-dynamic";

function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const userId = await getCurrentUserId();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1);
  if (previousEnd > monthStart) previousEnd.setTime(monthStart.getTime());

  const requestedId = request.nextUrl.searchParams.get("instagramAccountId");
  const selectedAccountId = requestedId && requestedId !== "all" ? requestedId : null;
  const accountFilter = selectedAccountId ? { instagramAccountId: selectedAccountId } : {};
  const currentWindow = { createdAt: { gte: monthStart, lt: monthEnd } };
  const previousWindow = { createdAt: { gte: previousStart, lt: previousEnd } };
  const intent = { commentId: { not: { startsWith: "dm:" } } } as const;

  const [workspace, instagramAccount, instagramAccounts, totalAutomations, activeAutomations,
    dmsSentToday, dmsSentWeek, totalDMs, intentCurrent, intentPrevious,
    sentCurrent, sentPrevious, statusRows, clicksCurrent, clicksPrevious, totalClicks,
    keywordRows, recentLogs, user, contactsCurrent, contactsPrevious] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, dmsSentThisPeriod: true } }),
    prisma.instagramAccount.findFirst({ where: { workspaceId }, orderBy: { connectedAt: "desc" }, select: { id: true, username: true, instagramId: true, tokenExpiresAt: true, webhookSubscribed: true } }),
    prisma.instagramAccount.findMany({ where: { workspaceId }, orderBy: { connectedAt: "desc" }, select: { id: true, username: true, instagramId: true, name: true, tokenExpiresAt: true, webhookSubscribed: true } }),
    prisma.automation.count({ where: { workspaceId, ...accountFilter } }),
    prisma.automation.count({ where: { workspaceId, isActive: true, ...accountFilter } }),
    prisma.dmLog.count({ where: { workspaceId, status: "SENT", createdAt: { gte: todayStart }, ...accountFilter } }),
    prisma.dmLog.count({ where: { workspaceId, status: "SENT", createdAt: { gte: weekStart }, ...accountFilter } }),
    prisma.dmLog.count({ where: { workspaceId, status: "SENT", ...accountFilter } }),
    prisma.dmLog.count({ where: { workspaceId, ...intent, ...currentWindow, ...accountFilter } }),
    prisma.dmLog.count({ where: { workspaceId, ...intent, ...previousWindow, ...accountFilter } }),
    prisma.dmLog.count({ where: { workspaceId, ...intent, status: "SENT", ...currentWindow, ...accountFilter } }),
    prisma.dmLog.count({ where: { workspaceId, ...intent, status: "SENT", ...previousWindow, ...accountFilter } }),
    prisma.dmLog.groupBy({ by: ["status"], where: { workspaceId, ...currentWindow, ...accountFilter }, _count: { _all: true } }),
    prisma.linkClick.count({ where: { workspaceId, ...currentWindow, ...accountFilter } }),
    prisma.linkClick.count({ where: { workspaceId, ...previousWindow, ...accountFilter } }),
    prisma.linkClick.count({ where: { workspaceId, ...accountFilter } }),
    prisma.dmLog.groupBy({ by: ["matchedKeyword"], where: { workspaceId, ...intent, matchedKeyword: { not: null }, ...currentWindow, ...accountFilter }, _count: { _all: true } }),
    prisma.dmLog.findMany({ where: { workspaceId, ...intent, ...currentWindow, ...accountFilter }, orderBy: { createdAt: "desc" }, take: 10, include: { automation: { select: { name: true } }, instagramAccount: { select: { username: true } } } }),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }) : Promise.resolve(null),
    prisma.dmLog.findMany({ where: { workspaceId, ...intent, ...currentWindow, ...accountFilter }, distinct: ["commenterId"], select: { commenterId: true } }),
    prisma.dmLog.findMany({ where: { workspaceId, ...intent, ...previousWindow, ...accountFilter }, distinct: ["commenterId"], select: { commenterId: true } }),
  ]);

  const dailyIntentComments = await Promise.all(Array.from({ length: now.getDate() }, async (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth(), index + 1);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const count = await prisma.dmLog.count({ where: { workspaceId, ...intent, createdAt: { gte: start, lt: end }, ...accountFilter } });
    return { date: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), count };
  }));

  const health = summarizeDmStatuses(statusRows.map((row) => ({ status: row.status, _count: row._count._all })));
  const topKeywords = normalizeTopKeywords(keywordRows.map((row) => ({ matchedKeyword: row.matchedKeyword, _count: row._count._all })));
  const advance = calculateCtr(clicksCurrent, sentCurrent);
  const previousAdvance = calculateCtr(clicksPrevious, sentPrevious);
  const firstName = user?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || null;

  return NextResponse.json({ success: true, data: {
    userName: firstName, workspace, instagramAccount, instagramAccounts, selectedInstagramAccountId: selectedAccountId,
    totalAutomations, activeAutomations, dmsSentToday, dmsSentWeek, totalDMs, totalClicks,
    contactsCount: contactsCurrent.length, dmsSentMonth: sentCurrent, dmsSkippedMonth: health.skipped,
    dmsFailedMonth: health.failed, clicksThisMonth: clicksCurrent, ctrThisMonth: advance,
    intentCommentsMonth: intentCurrent, dmsDeliveredMonth: sentCurrent, advanceRateMonth: advance,
    comparisons: {
      intentComments: change(intentCurrent, intentPrevious),
      uniqueContacts: change(contactsCurrent.length, contactsPrevious.length),
      dmsDelivered: change(sentCurrent, sentPrevious),
      clicks: change(clicksCurrent, clicksPrevious),
      advanceRate: Number((advance - previousAdvance).toFixed(1)),
    },
    comparisonPeriod: { currentLabel: "mês atual até hoje", previousLabel: "mesmo intervalo do mês anterior" },
    operationalHealth: { delivered: health.sent, skipped: health.skipped, failed: health.failed },
    topKeywords, dailyIntentComments, dailyDMs: dailyIntentComments, recentLogs,
  } }, { headers: { "Cache-Control": "no-store" } });
}
