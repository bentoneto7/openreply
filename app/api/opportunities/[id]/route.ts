import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { opportunityPatchSchema } from "@/lib/crm/contracts";
import {
  opportunityDetailSelect,
  toOpportunityDetailDto,
} from "@/lib/crm/opportunity-dto";
import { fingerprintRequest, sanitizeEventMetadata } from "@/lib/crm/event-metadata";
import {
  canChangeOpportunityAssignee,
  stageTimestampPatch,
  validateOpportunityOutcome,
} from "@/lib/crm/opportunity";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string }> };

class OpportunityApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly data?: Record<string, unknown>
  ) {
    super(message);
  }
}

function jsonError(error: OpportunityApiError) {
  return NextResponse.json(
    { success: false, error: error.message, code: error.code, ...(error.data ? { data: error.data } : {}) },
    { status: error.status }
  );
}

export async function GET(_request: NextRequest, { params }: RouteProps) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const row = await prisma.lead.findFirst({
    where: { id, workspaceId: context.workspaceId },
    select: opportunityDetailSelect,
  });
  if (!row) {
    return NextResponse.json({ success: false, error: "Oportunidade não encontrada" }, { status: 404 });
  }
  return NextResponse.json(
    { success: true, data: { opportunity: toOpportunityDetailDto(row) } },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = opportunityPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Alteração inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const input = parsed.data;
  const requestFingerprint = fingerprintRequest(input);
  const sourceEventKey = `api:opportunity:${id}:${input.idempotencyKey}`;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
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
            throw new OpportunityApiError(
              409,
              "IDEMPOTENCY_KEY_REUSED",
              "A chave de idempotência já foi usada com outro conteúdo"
            );
          }
          const replayed = await tx.lead.findFirst({
            where: { id, workspaceId: context.workspaceId },
            select: opportunityDetailSelect,
          });
          if (!replayed) {
            throw new OpportunityApiError(404, "NOT_FOUND", "Oportunidade não encontrada");
          }
          return { opportunity: replayed, replayed: true };
        }

        const current = await tx.lead.findFirst({
          where: { id, workspaceId: context.workspaceId },
          select: {
            id: true,
            status: true,
            version: true,
            lossReason: true,
            assigneeMemberId: true,
            sales: { where: { status: "CONFIRMED" }, select: { id: true }, take: 1 },
          },
        });
        if (!current) {
          throw new OpportunityApiError(404, "NOT_FOUND", "Oportunidade não encontrada");
        }
        if (current.version !== input.expectedVersion) {
          throw new OpportunityApiError(
            409,
            "VERSION_CONFLICT",
            "A oportunidade foi alterada por outra pessoa",
            { currentVersion: current.version }
          );
        }

        const actor = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: { workspaceId: context.workspaceId, userId: context.userId },
          },
          select: { id: true },
        });
        if (!actor) {
          throw new OpportunityApiError(403, "MEMBERSHIP_REQUIRED", "Membro do workspace não encontrado");
        }

        if (input.assigneeMemberId !== undefined) {
          if (
            !canChangeOpportunityAssignee({
              role: context.role,
              actorMemberId: actor.id,
              currentAssigneeMemberId: current.assigneeMemberId,
              nextAssigneeMemberId: input.assigneeMemberId,
            })
          ) {
            throw new OpportunityApiError(
              403,
              "ASSIGNEE_FORBIDDEN",
              "Apenas proprietários e administradores podem atribuir outro membro"
            );
          }
          if (input.assigneeMemberId) {
            const targetMember = await tx.workspaceMember.findFirst({
              where: { id: input.assigneeMemberId, workspaceId: context.workspaceId },
              select: { id: true },
            });
            if (!targetMember) {
              throw new OpportunityApiError(400, "INVALID_ASSIGNEE", "Responsável inválido para este workspace");
            }
          }
        }

        const outcomeError = validateOpportunityOutcome({
          currentStatus: current.status,
          currentLossReason: current.lossReason,
          next: input,
          hasConfirmedSale: current.sales.length > 0,
        });
        if (outcomeError) {
          throw new OpportunityApiError(400, "INVALID_OUTCOME", outcomeError);
        }

        const now = new Date();
        const updateData: Prisma.LeadUncheckedUpdateManyInput = { version: { increment: 1 } };
        const changedFields: string[] = [];
        const copyNullable = <K extends "note" | "productOffer" | "potentialValueCents" | "nextAction" | "lossReason">(
          key: K
        ) => {
          if (input[key] !== undefined) {
            Object.assign(updateData, { [key]: input[key] });
            changedFields.push(key);
          }
        };
        copyNullable("note");
        copyNullable("productOffer");
        copyNullable("potentialValueCents");
        copyNullable("nextAction");
        copyNullable("lossReason");

        if (input.nextActionAt !== undefined) {
          updateData.nextActionAt = input.nextActionAt ? new Date(input.nextActionAt) : null;
          changedFields.push("nextActionAt");
        }
        if (input.assigneeMemberId !== undefined) {
          updateData.assigneeMemberId = input.assigneeMemberId;
          updateData.assigneeWorkspaceId = input.assigneeMemberId ? context.workspaceId : null;
          changedFields.push("assigneeMemberId");
        }
        if (input.intentCategory !== undefined) {
          updateData.intentCategory = input.intentCategory;
          updateData.intentSource = "HUMAN";
          updateData.intentCorrectedAt = now;
          changedFields.push("intentCategory");
        }
        if (input.status !== undefined) {
          updateData.status = input.status;
          if (input.status !== current.status) Object.assign(updateData, stageTimestampPatch(input.status, now));
          if (input.status !== "PERDIDO" && input.lossReason === undefined) updateData.lossReason = null;
          changedFields.push("status");
        }
        if (input.sale) changedFields.push("sale");

        const updated = await tx.lead.updateMany({
          where: { id, workspaceId: context.workspaceId, version: input.expectedVersion },
          data: updateData,
        });
        if (updated.count !== 1) {
          throw new OpportunityApiError(
            409,
            "VERSION_CONFLICT",
            "A oportunidade foi alterada por outra pessoa"
          );
        }

        let saleId: string | null = null;
        if (input.sale) {
          const sale = await tx.sale.create({
            data: {
              workspaceId: context.workspaceId,
              leadId: id,
              status: "CONFIRMED",
              amountCents: input.sale.amountCents,
              currency: input.sale.currency,
              source: "MANUAL",
              confirmedAt: now,
              idempotencyKey: `opportunity:${id}:${input.idempotencyKey}`,
            },
            select: { id: true },
          });
          saleId = sale.id;
        }

        const eventType =
          input.status !== undefined && input.status !== current.status
            ? "STATUS_CHANGED"
            : input.assigneeMemberId !== undefined && input.assigneeMemberId !== current.assigneeMemberId
              ? "ASSIGNEE_CHANGED"
              : input.intentCategory !== undefined
                ? "INTENT_CORRECTED"
                : input.sale
                  ? "SALE_CONFIRMED"
                  : "COMMERCIAL_FIELDS_UPDATED";
        await tx.leadEvent.create({
          data: {
            workspaceId: context.workspaceId,
            leadId: id,
            type: eventType,
            fromStatus: current.status,
            toStatus: input.status ?? current.status,
            actorMemberId: actor.id,
            actorWorkspaceId: context.workspaceId,
            sourceEventKey,
            requestFingerprint,
            metadata: sanitizeEventMetadata({ changedFields, saleId }) as Prisma.InputJsonValue,
            occurredAt: now,
          },
        });
        if (saleId && eventType !== "SALE_CONFIRMED") {
          await tx.leadEvent.create({
            data: {
              workspaceId: context.workspaceId,
              leadId: id,
              type: "SALE_CONFIRMED",
              fromStatus: current.status,
              toStatus: input.status ?? current.status,
              actorMemberId: actor.id,
              actorWorkspaceId: context.workspaceId,
              sourceEventKey: `${sourceEventKey}:sale`,
              requestFingerprint,
              metadata: sanitizeEventMetadata({ saleId }) as Prisma.InputJsonValue,
              occurredAt: now,
            },
          });
        }

        const opportunity = await tx.lead.findFirst({
          where: { id, workspaceId: context.workspaceId },
          select: opportunityDetailSelect,
        });
        if (!opportunity) {
          throw new OpportunityApiError(404, "NOT_FOUND", "Oportunidade não encontrada");
        }
        return { opportunity, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(
      {
        success: true,
        data: { opportunity: toOpportunityDetailDto(result.opportunity) },
        meta: { replayed: result.replayed },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof OpportunityApiError) return jsonError(error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return jsonError(
        new OpportunityApiError(
          409,
          "CONCURRENT_REQUEST",
          "A alteração concorrente não foi aplicada; recarregue a oportunidade"
        )
      );
    }
    console.error("[Opportunities] PATCH failed", error);
    return NextResponse.json(
      { success: false, error: "Não foi possível atualizar a oportunidade" },
      { status: 500 }
    );
  }
}
