import type { LeadStatus, WorkspaceRole } from "@/app/generated/prisma/client";
import type { OpportunityPatchInput } from "@/lib/crm/contracts";

export type OpportunityCursor = { updatedAt: string; id: string };

export function encodeOpportunityCursor(cursor: OpportunityCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeOpportunityCursor(value: string): OpportunityCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OpportunityCursor>;
    if (
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      typeof parsed.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.updatedAt))
    ) {
      return null;
    }
    return { id: parsed.id, updatedAt: new Date(parsed.updatedAt).toISOString() };
  } catch {
    return null;
  }
}

export function validateOpportunityOutcome(input: {
  currentStatus: LeadStatus;
  currentLossReason: string | null;
  next: OpportunityPatchInput;
  hasConfirmedSale: boolean;
}): string | null {
  const targetStatus = input.next.status ?? input.currentStatus;
  if (
    input.currentStatus === "GANHO" &&
    input.hasConfirmedSale &&
    input.next.status !== undefined &&
    targetStatus !== "GANHO"
  ) {
    return "Uma oportunidade com venda confirmada só pode sair de GANHO após uma anulação explícita e auditada da venda";
  }
  if (
    input.currentStatus === "PERDIDO" &&
    input.next.status !== undefined &&
    targetStatus !== "PERDIDO"
  ) {
    return "Uma oportunidade PERDIDA só pode ser reaberta por uma ação explícita e auditada, ainda não disponível";
  }
  if (input.hasConfirmedSale && input.next.sale) {
    return "Esta oportunidade já possui uma venda confirmada; anule a venda existente antes de registrar outra";
  }
  if (targetStatus === "GANHO" && !input.hasConfirmedSale && !input.next.sale) {
    return "Uma venda confirmada com valor e moeda é obrigatória para marcar como GANHO";
  }
  const lossReason = input.next.lossReason === undefined ? input.currentLossReason : input.next.lossReason;
  if (targetStatus === "PERDIDO" && !lossReason?.trim()) {
    return "O motivo da perda é obrigatório para marcar como PERDIDO";
  }
  if (input.next.sale && targetStatus !== "GANHO") {
    return "Uma venda só pode ser confirmada junto de uma oportunidade GANHA";
  }
  return null;
}

export function canChangeOpportunityAssignee(input: {
  role: WorkspaceRole;
  actorMemberId: string;
  currentAssigneeMemberId: string | null;
  nextAssigneeMemberId: string | null;
}) {
  if (input.role === "OWNER" || input.role === "ADMIN") return true;
  if (
    input.nextAssigneeMemberId === input.actorMemberId &&
    (input.currentAssigneeMemberId === null || input.currentAssigneeMemberId === input.actorMemberId)
  ) {
    return true;
  }
  return (
    input.nextAssigneeMemberId === null &&
    (input.currentAssigneeMemberId === null || input.currentAssigneeMemberId === input.actorMemberId)
  );
}

export function stageTimestampPatch(status: LeadStatus | undefined, now: Date) {
  switch (status) {
    case "NOVO":
      return { newAt: now };
    case "ABORDADO":
      return { approachedAt: now, lastContactedAt: now };
    case "RESPONDEU":
      return { respondedAt: now, lastContactedAt: now };
    case "NEGOCIANDO":
      return { negotiatingAt: now, lastContactedAt: now };
    case "GANHO":
      return { wonAt: now, lastContactedAt: now };
    case "PERDIDO":
      return { lostAt: now, lastContactedAt: now };
    default:
      return {};
  }
}
