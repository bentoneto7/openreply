const SKIPPED_PREFIX = "SKIPPED_";

export interface StatusCountRow {
  status: string;
  _count: number | { status?: number; _all?: number };
}

export interface KeywordCountRow {
  matchedKeyword: string | null;
  _count: number | { matchedKeyword?: number; _all?: number };
}

function getCount(value: StatusCountRow["_count"] | KeywordCountRow["_count"]) {
  if (typeof value === "number") return value;
  if ("status" in value && typeof value.status === "number") {
    return value.status;
  }
  if ("matchedKeyword" in value && typeof value.matchedKeyword === "number") {
    return value.matchedKeyword;
  }
  return value._all ?? 0;
}

/**
 * Prefixos de commentId que o worker grava em DmLog para sinais que NÃO são
 * comentários: `dm:` (DM recebida) e `reveal:` (toque no botão do link).
 */
export const SIGNAL_PREFIXES = ["dm:", "reveal:"];

/**
 * Definição única de "comentário acionado": linha de DmLog originada de um
 * comentário real. Dashboard e mapa de calor importam daqui — duas telas
 * vizinhas com o mesmo rótulo não podem contar coisas diferentes.
 */
export const intentCommentFilter = {
  AND: SIGNAL_PREFIXES.map((prefix) => ({ commentId: { not: { startsWith: prefix } } })),
};

/**
 * Um comentário casado por três campanhas vira três linhas em DmLog
 * (@@unique([automationId, commentId])). Conta comentário, não linha — total do
 * mês e série diária saem do mesmo de-dup, então o gráfico fecha com o card.
 * `days` é o número de dias já decorridos no mês corrente.
 */
export function summarizeIntentComments(rows: { commentId: string; createdAt: Date }[], days: number) {
  const perDay = Array.from({ length: days }, () => new Set<string>());
  const all = new Set<string>();
  for (const row of rows) {
    all.add(row.commentId);
    const index = row.createdAt.getDate() - 1;
    if (index >= 0 && index < days) perDay[index].add(row.commentId);
  }
  return { total: all.size, daily: perDay.map((set) => set.size) };
}

/** `null` = nada enviado ainda. Zero seria "medimos e deu 0%", que é mentira. */
export function calculateCtr(clicks: number, sent: number): number | null {
  if (sent <= 0) return null;
  // LinkClick stores access events, not unique recipients. Repeat accesses and
  // automated previews can therefore make this ratio exceed 100%; preserving
  // the computed value is more auditable than silently capping the evidence.
  return Number(((clicks / sent) * 100).toFixed(1));
}

export function summarizeDmStatuses(rows: StatusCountRow[]) {
  return rows.reduce(
    (summary, row) => {
      const count = getCount(row._count);
      if (row.status === "SENT") summary.sent += count;
      if (row.status === "FAILED") summary.failed += count;
      if (row.status.startsWith(SKIPPED_PREFIX)) summary.skipped += count;
      return summary;
    },
    { sent: 0, skipped: 0, failed: 0 }
  );
}

export function normalizeTopKeywords(rows: KeywordCountRow[], limit = 5) {
  return rows
    .filter((row) => row.matchedKeyword)
    .map((row) => ({
      keyword: row.matchedKeyword as string,
      count: getCount(row._count),
    }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}
