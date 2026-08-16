import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { LEAD_STATUSES } from "@/lib/crm/lead-status";

export const dynamic = "force-dynamic";

const updateLeadSchema = z.object({
  instagramAccountId: z.string().min(1),
  commenterId: z.string().min(1),
  commenterName: z.string().max(200).nullish(),
  status: z.enum(LEAD_STATUSES),
  note: z.string().max(2000).nullish(),
});

// Só PATCH: a leitura dos leads vem junto da fila em /api/heatmap/overview, que
// é onde eles são exibidos. Um GET aqui nasceria sem nenhum consumidor.
export async function PATCH(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

  const parsed = updateLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Dados inválidos" }, { status: 400 });
  const { instagramAccountId, commenterId, commenterName, status, note } = parsed.data;

  // A conta precisa ser deste workspace: sem isso o par (conta, comentarista)
  // deixaria qualquer sessão escrever no lead de outro cliente.
  const account = await prisma.instagramAccount.findFirst({ where: { id: instagramAccountId, workspaceId }, select: { id: true } });
  if (!account) return NextResponse.json({ success: false, error: "Conta não encontrada" }, { status: 404 });

  // NOVO é o estado de quem ainda não foi abordado, então não marca contato.
  const contacted = status !== "NOVO" ? { lastContactedAt: new Date() } : {};
  const lead = await prisma.lead.upsert({
    where: { instagramAccountId_commenterId: { instagramAccountId, commenterId } },
    create: { workspaceId, instagramAccountId, commenterId, commenterName: commenterName ?? null, status, note: note ?? null, ...contacted },
    update: { status, ...(note === undefined ? {} : { note: note ?? null }), ...(commenterName ? { commenterName } : {}), ...contacted },
    select: { instagramAccountId: true, commenterId: true, commenterName: true, status: true, note: true, lastContactedAt: true, updatedAt: true },
  });

  return NextResponse.json({ success: true, data: { lead } }, { headers: { "Cache-Control": "no-store" } });
}
