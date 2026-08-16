import type { InstagramConversation } from "@/lib/meta/client";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { temperatureForScore, type LeadTemperature } from "@/lib/heatmap/priority";

/**
 * Fila de leads construída só com a atividade de DM que a conta já tem hoje —
 * sem comentários, sem App Review e sem nenhuma automação configurada.
 *
 * Todo sinal aqui é rotulado pelo que ele é: uma DM recebida é uma DM recebida,
 * não "intenção". Sinal que a Meta não devolve é omitido, nunca zerado.
 */

/** Janela de mensagens da Meta: 24h contadas da última mensagem da pessoa. */
export const MESSAGING_WINDOW_HOURS = 24;

/**
 * O ID salvo em `instagramAccount.instagramId` não identifica a conta dentro das
 * conversas. Como `fromMe` é `from.id === instagramId`, toda mensagem passaria a
 * ser lida como recebida e a fila inteira inverteria. Falhar alto é melhor do
 * que devolver 50 leads errados.
 */
export class DmQueueAccountIdentityError extends Error {
  constructor(public readonly instagramId: string, public readonly threadCount: number) {
    super(
      `O ID salvo desta conta (${instagramId}) não aparece em nenhuma das ${threadCount} conversas. ` +
        `Sem isso não dá para saber quem falou por último e a fila sairia invertida. ` +
        `Reconecte a conta do Instagram (o ID correto é o user_id profissional, não o id do app).`
    );
    this.name = "DmQueueAccountIdentityError";
  }
}

/** Uma conversa cuja última mensagem é da pessoa e segue sem resposta. */
export interface InboundThread {
  conversationId: string;
  /** IGSID de quem escreveu — é o mesmo valor que `Lead.commenterId`. */
  commenterId: string;
  commenterName: string | null;
  text: string;
  /** Horário da última mensagem recebida, ou null quando a Meta não devolve. */
  receivedAt: Date | null;
}

export interface DmQueueItem {
  position: number;
  /** `${instagramAccountId}:${commenterId}` — mesma chave do mapa de calor. */
  key: string;
  conversationId: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName: string | null;
  lastInboundMessage: string;
  lastInboundAt: string | null;
  /** Horas restantes da janela de 24h. Negativo = já fechou. null = sem horário. */
  hoursLeftInWindow: number | null;
  windowOpen: boolean;
  /** `is_user_follow_business`. null = a Meta não respondeu — não é "não segue". */
  followsAccount: boolean | null;
  matchedKeyword: string | null;
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
}

/**
 * Faixas de urgência. A urgência é o único sinal com prazo real, então ela
 * domina: o degrau entre faixas (20) é maior que a soma dos reforços (13), de
 * modo que seguir a conta ou citar palavra-chave só reordena dentro da faixa.
 */
const URGENCY_BANDS: { withinHours: number; points: number }[] = [
  { withinHours: 2, points: 80 },
  { withinHours: 6, points: 60 },
  { withinHours: 12, points: 40 },
  { withinHours: MESSAGING_WINDOW_HOURS, points: 20 },
];
const FOLLOW_LIFT = 8;
const KEYWORD_LIFT = 5;

function urgencyPoints(hoursLeft: number | null): number {
  if (hoursLeft === null || hoursLeft <= 0) return 0;
  return URGENCY_BANDS.find((band) => hoursLeft <= band.withinHours)?.points ?? 0;
}

function formatDuration(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Portão da fila: só as conversas em que a outra pessoa falou por último.
 * Também confere que o ID salvo da conta realmente aparece nas conversas —
 * ver `DmQueueAccountIdentityError`.
 */
export function selectInboundThreads(
  threads: InstagramConversation[],
  accountInstagramId: string
): InboundThread[] {
  if (threads.length === 0) return [];

  // A conta tem que aparecer em algum lugar: como participante de alguma
  // conversa ou como autora de alguma última mensagem. Some de todas as 50 só
  // se o ID salvo não for o da conta.
  const identified = threads.some(
    (thread) =>
      (thread.participants?.data ?? []).some((p) => p.id === accountInstagramId) ||
      thread.messages?.data?.[0]?.from?.id === accountInstagramId
  );
  if (!identified) throw new DmQueueAccountIdentityError(accountInstagramId, threads.length);

  const inbound: InboundThread[] = [];
  for (const thread of threads) {
    const last = thread.messages?.data?.[0];
    const fromId = last?.from?.id;
    // Sem autor identificável não dá para afirmar que a mensagem é recebida.
    if (!last || !fromId || fromId === accountInstagramId) continue;

    const participant = (thread.participants?.data ?? []).find((p) => p.id === fromId);
    // `created_time` da mensagem é o que conta para a janela; `updated_time` da
    // conversa só entra se a Meta omitir o primeiro.
    const timestamp = last.created_time ?? thread.updated_time ?? null;
    const receivedAt = timestamp ? new Date(timestamp) : null;

    inbound.push({
      conversationId: thread.id,
      commenterId: fromId,
      commenterName: last.from?.username ?? participant?.username ?? null,
      text: last.message ?? "",
      receivedAt: receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null,
    });
  }
  return inbound;
}

export function buildDmQueue(
  inbound: InboundThread[],
  options: {
    instagramAccountId: string;
    keywords?: string[];
    /** IGSID → `is_user_follow_business`. Ausente ou null = desconhecido. */
    followStatus?: Record<string, boolean | null>;
    now?: Date;
  }
): DmQueueItem[] {
  const { instagramAccountId, keywords = [], followStatus = {}, now = new Date() } = options;

  const scored = inbound.map((thread) => {
    const hoursLeftInWindow =
      thread.receivedAt === null
        ? null
        : MESSAGING_WINDOW_HOURS - (now.getTime() - thread.receivedAt.getTime()) / 3_600_000;
    const windowOpen = hoursLeftInWindow !== null && hoursLeftInWindow > 0;
    const followsAccount = followStatus[thread.commenterId] ?? null;
    const { matchedKeyword } = matchKeywords(thread.text, keywords);

    const score = Math.min(
      100,
      urgencyPoints(hoursLeftInWindow) +
        (followsAccount === true ? FOLLOW_LIFT : 0) +
        (matchedKeyword ? KEYWORD_LIFT : 0)
    );

    const reasons = ["a última mensagem é da pessoa e segue sem resposta"];
    if (hoursLeftInWindow !== null) {
      reasons.push(
        windowOpen
          ? `janela de 24h da Meta fecha em ${formatDuration(hoursLeftInWindow)}`
          : `janela de 24h da Meta fechou há ${formatDuration(-hoursLeftInWindow)}`
      );
    }
    // Só afirma o que a Meta confirmou: `null` é "não respondeu", não "não segue".
    if (followsAccount === true) reasons.push("segue a conta no Instagram");
    if (followsAccount === false) reasons.push("não segue a conta no Instagram");
    if (matchedKeyword) reasons.push(`a DM cita a palavra-chave "${matchedKeyword}"`);

    return {
      key: `${instagramAccountId}:${thread.commenterId}`,
      conversationId: thread.conversationId,
      instagramAccountId,
      commenterId: thread.commenterId,
      commenterName: thread.commenterName,
      lastInboundMessage: thread.text,
      lastInboundAt: thread.receivedAt?.toISOString() ?? null,
      hoursLeftInWindow,
      windowOpen,
      followsAccount,
      matchedKeyword,
      score,
      temperature: temperatureForScore(score),
      reasons,
    };
  });

  // Ordem determinística: pontuação, depois a distância até a borda da janela —
  // aberta, quem fecha antes; fechada, quem fechou mais recentemente; sem
  // horário, por último. No empate, o ID da conversa.
  const edge = (item: (typeof scored)[number]) =>
    item.hoursLeftInWindow === null ? Infinity : Math.abs(item.hoursLeftInWindow);
  scored.sort(
    (a, b) => b.score - a.score || edge(a) - edge(b) || a.conversationId.localeCompare(b.conversationId)
  );

  return scored.map((item, index) => ({ position: index + 1, ...item }));
}
