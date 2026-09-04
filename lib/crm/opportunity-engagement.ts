import {
  buildHeatmapQueue,
  periodStart,
  type HeatmapLog,
  type HeatmapPeriod,
  type LeadTemperature,
} from "@/lib/heatmap/priority";

/**
 * Fila de oportunidades ordenada por engajamento — do mais engajado para o
 * menos engajado, que é a mesma coisa que "de quem tem mais chance de virar
 * venda para quem tem menos".
 *
 * A pontuação NÃO é nova: é exatamente a do mapa de calor
 * (`lib/heatmap/priority.ts`), que já pondera relacionamento e intenção
 * comercial por sinal e por recência. Duas telas vizinhas mostrando dois
 * números diferentes com o mesmo nome ("engajamento") seria pior do que não ter
 * a ordenação. `Lead` é chaveado por `(instagramAccountId, commenterId)`, que é
 * exatamente a chave do mapa de calor, então o score cruza direto.
 *
 * O que ela é: uma leitura dos sinais observados (comentário, comentário com
 * palavra-chave, DM recebida, abertura da DM com link) no período. O que ela
 * não é: uma previsão de receita. Ninguém aqui promete que o topo da fila
 * compra — só que é onde vale gastar o próximo atendimento.
 */

/**
 * Janela da fila. Fixa em 7 dias porque é o recorte que a tela promete no
 * rótulo, e porque `recencyFactor` do mapa de calor trata tudo dentro de 7 dias
 * com peso 1: dentro dessa janela a ordem é decidida pelos sinais, não pela
 * idade deles.
 */
export const ENGAGEMENT_PERIOD: HeatmapPeriod = "7d";

/**
 * Teto da amostra de sinais lida do banco, por tipo. Espelha o do mapa de calor
 * de propósito: a mesma janela nas duas telas tem que caber na mesma amostra,
 * senão a ordem diverge entre elas sem nenhuma razão visível.
 */
export const ENGAGEMENT_SIGNAL_SAMPLE = 500;

export interface OpportunityEngagement {
  /** 0–100, na escala do mapa de calor. */
  score: number;
  temperature: LeadTemperature;
  /** Comentários distintos observados no período. */
  signalCount: number;
  /** Sinal mais recente de qualquer tipo, ISO 8601. */
  lastSeenAt: string;
  /** Por que essa pessoa está nessa posição, em português. */
  reasons: string[];
}

/** Chave de pessoa compartilhada com o mapa de calor e com a fila de DMs. */
export function engagementKey(instagramAccountId: string, commenterId: string) {
  return `${instagramAccountId}:${commenterId}`;
}

export function engagementWindowStart(now = new Date()) {
  return periodStart(ENGAGEMENT_PERIOD, now);
}

/**
 * Índice de engajamento por pessoa. Só entra quem teve sinal no período: uma
 * oportunidade sem sinal nos últimos 7 dias não recebe score 0, ela fica fora
 * do recorte. Zero seria "medimos e não houve engajamento", que é diferente de
 * "não olhamos essa janela".
 */
export function buildEngagementIndex(
  logs: HeatmapLog[],
  now = new Date()
): Map<string, OpportunityEngagement> {
  return new Map(
    buildHeatmapQueue(logs, now).map((item) => [
      item.key,
      {
        score: item.score,
        temperature: item.temperature,
        signalCount: item.signalCount,
        lastSeenAt: item.lastSeenAt,
        reasons: item.reasons,
      },
    ])
  );
}

/** O mínimo que uma linha de oportunidade precisa expor para ser pontuada. */
export interface RankableOpportunity {
  id: string;
  commenterId: string;
  instagramAccount: { id: string };
}

export interface RankedOpportunity<T extends RankableOpportunity> {
  row: T;
  engagement: OpportunityEngagement;
}

/**
 * Ordem: score, depois o sinal mais recente, depois o id. Os dois primeiros
 * critérios são os mesmos do mapa de calor; o id só existe para que duas
 * pessoas empatadas em tudo saiam sempre na mesma ordem — sem isso a paginação
 * por cursor pularia ou repetiria linhas.
 */
export function compareByEngagement<T extends RankableOpportunity>(
  a: RankedOpportunity<T>,
  b: RankedOpportunity<T>
): number {
  if (a.engagement.score !== b.engagement.score) {
    return b.engagement.score - a.engagement.score;
  }
  const seenDelta =
    Date.parse(b.engagement.lastSeenAt) - Date.parse(a.engagement.lastSeenAt);
  if (seenDelta !== 0) return seenDelta;
  return b.row.id.localeCompare(a.row.id);
}

export function rankByEngagement<T extends RankableOpportunity>(
  rows: T[],
  index: Map<string, OpportunityEngagement>
): RankedOpportunity<T>[] {
  const ranked: RankedOpportunity<T>[] = [];
  for (const row of rows) {
    const engagement = index.get(engagementKey(row.instagramAccount.id, row.commenterId));
    // Sem sinal no período a linha não pertence a este recorte. Ver
    // buildEngagementIndex: fora da janela não vira score 0.
    if (engagement) ranked.push({ row, engagement });
  }
  return ranked.sort(compareByEngagement);
}

export type EngagementCursor = { score: number; lastSeenAt: string; id: string };

/**
 * Continua a fila depois do cursor, na mesma ordem de `compareByEngagement`.
 * Keyset e não offset: entre uma página e outra chegam sinais novos e o score
 * de quem já foi mostrado muda, e um offset devolveria linhas repetidas.
 */
export function isAfterEngagementCursor<T extends RankableOpportunity>(
  item: RankedOpportunity<T>,
  cursor: EngagementCursor
): boolean {
  if (item.engagement.score !== cursor.score) return item.engagement.score < cursor.score;
  const itemSeen = Date.parse(item.engagement.lastSeenAt);
  const cursorSeen = Date.parse(cursor.lastSeenAt);
  if (itemSeen !== cursorSeen) return itemSeen < cursorSeen;
  return item.row.id.localeCompare(cursor.id) < 0;
}

export function encodeEngagementCursor(cursor: EngagementCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeEngagementCursor(value: string): EngagementCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<EngagementCursor>;
    if (
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      typeof parsed.score !== "number" ||
      !Number.isFinite(parsed.score) ||
      typeof parsed.lastSeenAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.lastSeenAt))
    ) {
      return null;
    }
    return {
      id: parsed.id,
      score: parsed.score,
      lastSeenAt: new Date(parsed.lastSeenAt).toISOString(),
    };
  } catch {
    return null;
  }
}
