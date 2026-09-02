import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getWorkerAlerts, getWorkerHealth } from "@/lib/ops/worker-health";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const runtime = "nodejs";

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const workspaceId = context.workspaceId;

  const [
    workerHealth,
    rawWorkerAlerts,
    webhookFailures,
    dmFailures,
    tokenRefreshFailures,
    operationalEvents,
    instagramAccounts,
  ] = await Promise.all([
    getWorkerHealth(),
    // O Redis mantém 25 alertas globais. Filtrar só os 10 primeiros permitiria
    // que atividade de outro workspace escondesse os alertas desta conta.
    getWorkerAlerts(25),
    prisma.webhookEvent.findMany({
      where: { workspaceId, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        object: true,
        errorMessage: true,
        createdAt: true,
        processedAt: true,
      },
    }),
    prisma.dmLog.findMany({
      where: {
        workspaceId,
        status: {
          in: [
            "FAILED",
            "SKIPPED_RATE_LIMIT",
            "SKIPPED_PLAN_LIMIT",
            "SKIPPED_NO_MATCH",
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        commentId: true,
        commentText: true,
        errorMessage: true,
        updatedAt: true,
        automation: { select: { name: true } },
      },
    }),
    prisma.operationalEvent.findMany({
      where: { workspaceId, source: "TOKEN_REFRESH", level: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        message: true,
        createdAt: true,
      },
    }),
    prisma.operationalEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        source: true,
        level: true,
        message: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
    prisma.instagramAccount.findMany({
      where: { workspaceId },
      select: { instagramId: true },
    }),
  ]);

  const workspaceInstagramIds = new Set(
    instagramAccounts.map((account) => account.instagramId)
  );
  const workerAlerts = rawWorkerAlerts.filter(
    (alert) =>
      alert.instagramAccountId !== undefined &&
      workspaceInstagramIds.has(alert.instagramAccountId)
  ).slice(0, 10);

  return NextResponse.json(
    {
      success: true,
      data: {
        // BullMQ is shared by every workspace and its aggregate counters do
        // not carry tenant ownership. Reporting them here would expose other
        // customers' activity, so keep the metric explicitly unavailable
        // until queue telemetry is partitioned by workspace.
        queueCounts: null,
        queueCountsReason: "queue_telemetry_not_partitioned_by_workspace",
        workerHealth,
        workerAlerts,
        webhookFailures,
        dmFailures,
        tokenRefreshFailures,
        operationalEvents,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
