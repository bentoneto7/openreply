export type HeatmapPeriod = "24h" | "7d" | "30d" | "90d";

export interface HeatmapLog {
  id: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName: string | null;
  commentId: string;
  commentText: string;
  matchedKeyword: string | null;
  status: string;
  createdAt: Date;
  automation: { name: string };
  instagramAccount: { username: string };
}

export type LeadTemperature =
  | "PRIORIDADE"
  | "QUENTE"
  | "INTERESSADO"
  | "ENGAJADO"
  | "OBSERVADOR";

export interface HeatmapQueueItem {
  key: string;
  instagramAccountId: string;
  instagramUsername: string;
  commenterId: string;
  commenterName: string | null;
  latestComment: string;
  latestKeyword: string | null;
  automationName: string;
  lastSeenAt: string;
  signalCount: number;
  sentCount: number;
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
}

const PERIOD_HOURS: Record<HeatmapPeriod, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30, "90d": 24 * 90 };

export function periodStart(period: HeatmapPeriod, now = new Date()) {
  return new Date(now.getTime() - PERIOD_HOURS[period] * 60 * 60 * 1000);
}

export function isHeatmapPeriod(value: string | null): value is HeatmapPeriod {
  return value === "24h" || value === "7d" || value === "30d" || value === "90d";
}

/**
 * Ordem comercial das temperaturas, da mais quente para a mais fria. A ordem
 * importa para agrupar e ordenar; os rótulos vêm da especificação do produto.
 */
export const TEMPERATURE_ORDER: LeadTemperature[] = ["PRIORIDADE", "QUENTE", "INTERESSADO", "ENGAJADO", "OBSERVADOR"];

export const TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  PRIORIDADE: "Prioridade comercial",
  QUENTE: "Lead quente",
  INTERESSADO: "Interessado",
  ENGAJADO: "Engajado",
  OBSERVADOR: "Observador",
};

type SignalKind = "comment" | "keywordComment" | "inboundDm" | "linkReveal";

/**
 * Pontos por sinal, na escala da especificação: relacionamento e intenção
 * comercial são somados separadamente e só depois ponderados.
 */
const SIGNAL_POINTS: Record<SignalKind, { relationship: number; intent: number }> = {
  comment: { relationship: 2, intent: 0 },
  keywordComment: { relationship: 2, intent: 6 },
  inboundDm: { relationship: 3, intent: 4 },
  // Vale pouco de propósito. A linha `reveal:` é gravada tanto quando a pessoa
  // toca no botão quanto pelo fallback de leitura da DM de abertura, e nada nela
  // distingue os dois casos. Um toque é intenção alta, uma leitura não é — na
  // dúvida, pontuar pelo que é certo: a DM foi aberta. Se um dia o worker
  // gravar os dois casos separadamente, o toque real merece intent 6.
  linkReveal: { relationship: 1, intent: 1 },
};

/**
 * Fator de recência: um sinal antigo continua contando, só que menos. Acima de
 * 90 dias ele zera, como manda a especificação.
 */
function recencyFactor(ageHours: number): number {
  if (ageHours <= 24 * 7) return 1;
  if (ageHours <= 24 * 30) return 0.75;
  if (ageHours <= 24 * 90) return 0.4;
  return 0;
}

/**
 * Escala que traduz a soma ponderada de pontos para a faixa 0–100 das bandas de
 * temperatura.
 *
 * ponytail: calibrado só para os sinais que a Meta expõe hoje (comentário, DM
 * recebida e clique de revelação). Quando reações, menções e respostas de Story
 * passarem a ser ingeridas, recalibrar aqui — e só aqui.
 */
export const SCORE_SCALE = 4;

function classifySignal(log: HeatmapLog): SignalKind {
  if (log.commentId.startsWith("dm:")) return "inboundDm";
  if (log.commentId.startsWith("reveal:")) return "linkReveal";
  return log.matchedKeyword ? "keywordComment" : "comment";
}

export function temperatureForScore(score: number): LeadTemperature {
  if (score >= 70) return "PRIORIDADE";
  if (score >= 45) return "QUENTE";
  if (score >= 25) return "INTERESSADO";
  if (score >= 10) return "ENGAJADO";
  return "OBSERVADOR";
}

export function buildHeatmapQueue(logs: HeatmapLog[], now = new Date()): HeatmapQueueItem[] {
  const groups = new Map<string, HeatmapLog[]>();
  for (const log of logs) {
    const key = `${log.instagramAccountId}:${log.commenterId}`;
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }

  return [...groups.entries()].map(([key, group]) => {
    const ordered = [...group].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    // Um mesmo comentário vira uma linha por automação: pontuar por linha
    // contaria o mesmo sinal várias vezes.
    const distinctSignals = new Map<string, HeatmapLog>();
    for (const log of ordered) if (!distinctSignals.has(log.commentId)) distinctSignals.set(log.commentId, log);
    const signals = [...distinctSignals.values()];

    // O texto exibido tem que ser algo que a pessoa escreveu: comentário, ou a
    // DM que ela mandou. Linhas `reveal:` nunca servem — o worker grava nelas o
    // literal "(button tap)", que vazaria para a tela como se fosse fala dela.
    const comments = signals.filter((item) => classifySignal(item) === "comment" || classifySignal(item) === "keywordComment");
    const written = comments[0] ?? signals.find((item) => classifySignal(item) === "inboundDm");
    const latest = written ?? ordered[0];
    const distinctComments = comments.length;
    const keywordCount = comments.filter((item) => Boolean(item.matchedKeyword)).length;
    const inboundDms = signals.filter((item) => classifySignal(item) === "inboundDm").length;
    const linkReveals = signals.filter((item) => classifySignal(item) === "linkReveal").length;

    let relationship = 0;
    let intent = 0;
    for (const signal of signals) {
      const points = SIGNAL_POINTS[classifySignal(signal)];
      const factor = recencyFactor(Math.max(0, (now.getTime() - signal.createdAt.getTime()) / 3_600_000));
      relationship += points.relationship * factor;
      intent += points.intent * factor;
    }
    const score = Math.min(100, Math.round(SCORE_SCALE * (0.35 * relationship + 0.65 * intent)));
    const temperature = temperatureForScore(score);

    // A recência é a do sinal mais novo de qualquer tipo — uma DM de hoje conta
    // como interação de hoje, mesmo que o último comentário seja da semana
    // passada.
    const lastSignal = ordered[0];
    const ageHours = Math.max(0, (now.getTime() - lastSignal.createdAt.getTime()) / 3_600_000);
    const reasons = [
      keywordCount > 0 ? `${keywordCount} sinal(is) com palavra-chave` : "comentário que acionou automação",
      `${distinctComments} comentário${distinctComments === 1 ? "" : "s"} distinto${distinctComments === 1 ? "" : "s"} observado${distinctComments === 1 ? "" : "s"}`,
      ageHours <= 24 ? "interação nas últimas 24 horas" : "interação recente no período",
    ];
    if (inboundDms > 0) reasons.push(`${inboundDms} mensagem(ns) enviada(s) por essa pessoa`);
    // Não afirmar "tocou no botão": a mesma linha é gravada quando a DM apenas
    // foi lida. Abrir a DM é o que dá para garantir.
    if (linkReveals > 0) reasons.push(`abriu a DM com o link ${linkReveals === 1 ? "uma vez" : `${linkReveals} vezes`}`);

    return {
      key, instagramAccountId: latest.instagramAccountId, instagramUsername: latest.instagramAccount.username,
      commenterId: latest.commenterId, commenterName: latest.commenterName,
      latestComment: written ? latest.commentText : "",
      latestKeyword: latest.matchedKeyword, automationName: latest.automation.name,
      lastSeenAt: lastSignal.createdAt.toISOString(), signalCount: distinctComments,
      sentCount: group.filter((item) => item.status === "SENT").length,
      score, temperature, reasons,
    };
    // Uma ordem só, a mesma que o badge de temperatura mostra: uma fila que
    // colocasse "Observador" acima de "Prioridade comercial" pareceria quebrada.
    // Empate cai para o sinal mais recente.
  }).sort((a, b) => b.score - a.score || new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
}

export function countByTemperature(queue: HeatmapQueueItem[]): Record<LeadTemperature, number> {
  const counts = { PRIORIDADE: 0, QUENTE: 0, INTERESSADO: 0, ENGAJADO: 0, OBSERVADOR: 0 };
  for (const item of queue) counts[item.temperature] += 1;
  return counts;
}
