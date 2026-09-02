import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { LEAD_STATUSES } from "@/lib/crm/lead-status";
import { fingerprintRequest, sanitizeEventMetadata } from "@/lib/crm/event-metadata";
import { stageTimestampPatch } from "@/lib/crm/opportunity";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const updateLeadSchema = z.object({
  instagramAccountId: z.string().min(1).max(191),
  commenterId: z.string().min(1).max(191),
  commenterName: z.string().max(200).nullish(),
  status: z.enum(LEAD_STATUSES),
  note: z.string().max(2000).nullish(),
  expectedVersion: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional(),
});

// Só PATCH: a leitura dos leads vem junto da fila em /api/heatmap/overview, que
// é onde eles são exibidos. Um GET aqui nasceria sem nenhum consumidor.
export async function PATCH(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

  const parsed = updateLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Dados inválidos" }, { status: 400 });
  const { instagramAccountId, commenterId, commenterName, status, note, expectedVersion, idempotencyKey } = parsed.data;

  // Closing an opportunity needs the atomic Sale/loss-reason contract exposed
  // by /api/opportunities/:id; the legacy heat-map endpoint remains open-stage
  // only so it cannot manufacture revenue or an unexplained loss.
  if (status === "GANHO" || status === "PERDIDO") {
    return NextResponse.json(
      {
        success: false,
        error: "Use a oportunidade para concluir como GANHO ou PERDIDO",
        code: "OPPORTUNITY_OUTCOME_REQUIRED",
      },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // A conta precisa ser deste workspace: sem isso o par (conta,
        // comentarista) deixaria qualquer sessão escrever no lead alheio.
        const [account, actor] = await Promise.all([
          tx.instagramAccount.findFirst({
            where: { id: instagramAccountId, workspaceId: context.workspaceId },
            select: { id: true },
          }),
          tx.workspaceMember.findUnique({
            where: {
              workspaceId_userId: {
                workspaceId: context.workspaceId,
                userId: context.userId,
              },
            },
            select: { id: true },
          }),
        ]);
        if (!account) return { kind: "not_found" as const };
        if (!actor) return { kind: "forbidden" as const };

        const current = await tx.lead.findFirst({
          where: { instagramAccountId, commenterId, workspaceId: context.workspaceId },
          select: { id: true, status: true, version: true },
        });
        if (current?.status === "GANHO" || current?.status === "PERDIDO") {
          return { kind: "terminal" as const };
        }
        if (current && expectedVersion !== undefined && expectedVersion !== current.version) {
          return { kind: "conflict" as const, currentVersion: current.version };
        }

        const requestFingerprint = fingerprintRequest(parsed.data);
        const sourceEventKey = idempotencyKey
          ? `api:legacy-lead:${instagramAccountId}:${commenterId}:${idempotencyKey}`
          : `api:legacy-lead:${randomUUID()}`;
        if (idempotencyKey) {
          const previousEvent = await tx.leadEvent.findUnique({
            where: {
              workspaceId_sourceEventKey: {
                workspaceId: context.workspaceId,
                sourceEventKey,
              },
            },
            select: { requestFingerprint: true },
          });
          if (previousEvent) {
            if (previousEvent.requestFingerprint !== requestFingerprint) {
              return { kind: "idempotency_conflict" as const };
            }
            if (!current) return { kind: "not_found" as const };
            const replayed = await tx.lead.findFirst({
              where: { id: current.id, workspaceId: context.workspaceId },
              select: {
                instagramAccountId: true,
                commenterId: true,
                commenterName: true,
                status: true,
                note: true,
                lastContactedAt: true,
                newAt: true,
                approachedAt: true,
                respondedAt: true,
                negotiatingAt: true,
                version: true,
                updatedAt: true,
              },
            });
            return replayed
              ? { kind: "success" as const, lead: replayed, replayed: true }
              : { kind: "not_found" as const };
          }
        }

        const now = new Date();
        const stageData = stageTimestampPatch(status, now);
        const lead = current
          ? await (async () => {
              const changed = await tx.lead.updateMany({
                where: {
                  id: current.id,
                  workspaceId: context.workspaceId,
                  version: current.version,
                },
                data: {
                  status,
                  ...(note === undefined ? {} : { note: note ?? null }),
                  ...(commenterName ? { commenterName } : {}),
                  ...stageData,
                  version: { increment: 1 },
                },
              });
              if (changed.count !== 1) return null;
              return tx.lead.findFirst({
                where: { id: current.id, workspaceId: context.workspaceId },
                select: {
                  id: true,
                  instagramAccountId: true,
                  commenterId: true,
                  commenterName: true,
                  status: true,
                  note: true,
                  lastContactedAt: true,
                  newAt: true,
                  approachedAt: true,
                  respondedAt: true,
                  negotiatingAt: true,
                  version: true,
                  updatedAt: true,
                },
              });
            })()
          : await tx.lead.create({
              data: {
                workspaceId: context.workspaceId,
                instagramAccountId,
                commenterId,
                commenterName: commenterName ?? null,
                status,
                note: note ?? null,
                originType: "MANUAL",
                ...stageData,
              },
              select: {
                id: true,
                instagramAccountId: true,
                commenterId: true,
                commenterName: true,
                status: true,
                note: true,
                lastContactedAt: true,
                newAt: true,
                approachedAt: true,
                respondedAt: true,
                negotiatingAt: true,
                version: true,
                updatedAt: true,
              },
            });
        if (!lead) return { kind: "conflict" as const };

        await tx.leadEvent.create({
          data: {
            workspaceId: context.workspaceId,
            leadId: lead.id,
            type: current?.status !== status ? "STATUS_CHANGED" : "COMMERCIAL_FIELDS_UPDATED",
            fromStatus: current?.status ?? null,
            toStatus: status,
            actorMemberId: actor.id,
            actorWorkspaceId: context.workspaceId,
            sourceEventKey,
            requestFingerprint,
            metadata: sanitizeEventMetadata({
              endpoint: "legacy_leads",
              changedFields: ["status", ...(note === undefined ? [] : ["note"])],
            }) as Prisma.InputJsonValue,
            occurredAt: now,
          },
        });

        return { kind: "success" as const, lead, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (result.kind === "not_found") {
      return NextResponse.json({ success: false, error: "Conta ou lead não encontrado" }, { status: 404 });
    }
    if (result.kind === "forbidden") {
      return NextResponse.json({ success: false, error: "Membro do workspace não encontrado" }, { status: 403 });
    }
    if (result.kind === "terminal") {
      return NextResponse.json(
        {
          success: false,
          error: "Use a oportunidade para alterar um estado terminal; uma venda confirmada exige anulação explícita e auditada",
          code: "OPPORTUNITY_OUTCOME_REQUIRED",
        },
        { status: 400 }
      );
    }
    if (result.kind === "conflict") {
      return NextResponse.json(
        {
          success: false,
          error: "O lead foi alterado por outra pessoa",
          code: "VERSION_CONFLICT",
          ...(result.currentVersion ? { data: { currentVersion: result.currentVersion } } : {}),
        },
        { status: 409 }
      );
    }
    if (result.kind === "idempotency_conflict") {
      return NextResponse.json(
        {
          success: false,
          error: "A chave de idempotência já foi usada com outro conteúdo",
          code: "IDEMPOTENCY_KEY_REUSED",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: true, data: { lead: result.lead }, meta: { replayed: result.replayed } },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Alteração concorrente; recarregue o lead", code: "CONCURRENT_REQUEST" },
        { status: 409 }
      );
    }
    console.error("[Leads] Legacy PATCH failed", error);
    return NextResponse.json({ success: false, error: "Não foi possível atualizar o lead" }, { status: 500 });
  }
}
