import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can disconnect accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const instagramAccountId =
    typeof body.instagramAccountId === "string"
      ? body.instagramAccountId.trim()
      : "";

  if (!instagramAccountId || instagramAccountId.length > 191) {
    return NextResponse.json(
      {
        success: false,
        error: "Informe a conta do Instagram que deve ser desconectada",
        code: "INSTAGRAM_ACCOUNT_REQUIRED",
      },
      { status: 400 }
    );
  }

  const account = await prisma.instagramAccount.findFirst({
    where: { id: instagramAccountId, workspaceId: context.workspaceId },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Conta do Instagram não encontrada" },
      { status: 404 }
    );
  }

  // Deleting an InstagramAccount cascades into operational and commercial
  // records. Until the schema supports a retained disconnected account, only a
  // truly empty connection can be removed. These relation predicates also make
  // the check part of the delete itself, avoiding a check-then-delete race.
  const deleted = await prisma.instagramAccount.deleteMany({
    where: {
      workspaceId: context.workspaceId,
      id: instagramAccountId,
      automations: { none: {} },
      dmLogs: { none: {} },
      leads: { none: {} },
      linkClicks: { none: {} },
      followerSnapshots: { none: {} },
    },
  });

  if (deleted.count !== 1) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Esta conta possui histórico operacional ou comercial. A desconexão foi bloqueada para preservar campanhas, entregas, oportunidades e vendas; solicite a exclusão de dados pelo fluxo apropriado.",
        code: "COMMERCIAL_HISTORY_REQUIRES_RETENTION",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}
