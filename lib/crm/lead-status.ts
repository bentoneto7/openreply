/**
 * Estados comerciais de um lead. A temperatura é observada pela plataforma; o
 * estado abaixo é sempre declarado por uma pessoa — é o que separa "a Comentou
 * viu um sinal" de "alguém aqui fez alguma coisa a respeito".
 */
export const LEAD_STATUSES = ["NOVO", "ABORDADO", "RESPONDEU", "NEGOCIANDO", "GANHO", "PERDIDO"] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatusValue, string> = {
  NOVO: "Não abordado",
  ABORDADO: "Abordado",
  RESPONDEU: "Respondeu",
  NEGOCIANDO: "Negociando",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

/** Estados que ainda pedem alguma ação humana. */
export const OPEN_LEAD_STATUSES: LeadStatusValue[] = ["NOVO", "ABORDADO", "RESPONDEU", "NEGOCIANDO"];

export function isLeadStatus(value: unknown): value is LeadStatusValue {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}
