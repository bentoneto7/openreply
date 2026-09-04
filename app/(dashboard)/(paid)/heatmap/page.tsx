"use client";

/**
 * Mapa de Calor — "Quem merece sua atenção agora".
 *
 * A fila vem de `/api/leads/queue`, que lê as conversas de DM da conta ao vivo
 * na Meta: quem falou por último, há quanto tempo, e quanto resta da janela de
 * 24h. Não há sinal de comentário aqui (o escopo não está liberado) e nada
 * depende de automação configurada — por isso a tela funciona numa conta recém
 * conectada, que é exatamente o caso que ela precisa atender.
 *
 * Regra da tela: nenhum número que não foi medido aparece como 0. O que a Meta
 * não devolveu aparece como "—".
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import TemperatureBadge from "@/components/temperature-badge";
import type { LeadTemperature } from "@/lib/heatmap/priority";
import { IN_PROGRESS_LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/lead-status";
import { AlertCircle, ArrowUpRight, Clock3, Handshake, Inbox, MessageCircle, RefreshCw, Search, Users } from "lucide-react";

interface QueueItem {
  position: number;
  key: string;
  conversationId: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName: string | null;
  lastInboundMessage: string;
  lastInboundAt: string | null;
  hoursLeftInWindow: number | null;
  windowOpen: boolean;
  followsAccount: boolean | null;
  matchedKeyword: string | null;
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
  leadStatus: LeadStatusValue;
  leadNote: string | null;
  lastContactedAt: string | null;
}

interface QueueData {
  account: { id: string; username: string };
  source: string;
  keywordSource: "automations" | "default";
  conversationsScanned: number;
  queue: QueueItem[];
}

/** 409 do guard de identidade pede reconexão, não "lista vazia". */
interface QueueError { message: string; reconnect: boolean }

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

// ponytail: espelha o formatDuration privado de lib/leads/dm-queue.ts. Se um dia
// ele for exportado, apagar este.
function formatHours(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Sem horário devolvido pela Meta o rótulo é "—" — nunca "0h". */
function windowLabel(item: QueueItem): { text: string; urgent: boolean } {
  if (item.hoursLeftInWindow === null) return { text: "—", urgent: false };
  if (!item.windowOpen) return { text: `janela fechada há ${formatHours(-item.hoursLeftInWindow)}`, urgent: false };
  return { text: `fecha em ${formatHours(item.hoursLeftInWindow)}`, urgent: item.hoursLeftInWindow <= 6 };
}

function displayName(item: QueueItem) { return item.commenterName ?? item.commenterId.slice(0, 10); }

function Metric({ label, value, helper, icon: Icon }: { label: string; value: number | string; helper: string; icon: typeof Users }) {
  return <div className="panel rounded p-5"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-muted">{label}</p><Icon className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden="true" /></div><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs leading-5 text-muted">{helper}</p></div>;
}

export default function HeatmapPage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<QueueError | null>(null);
  const [retry, setRetry] = useState(0);

  // Só para o seletor. A fila não espera por esta chamada: sem parâmetro, a rota
  // já usa a conta conectada mais recente e devolve qual foi.
  useEffect(() => {
    fetch("/api/instagram/accounts")
      .then((response) => response.json())
      .then((payload) => { if (payload.success) setAccounts(payload.data.instagramAccounts ?? []); })
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = accountId ? `?instagramAccountId=${encodeURIComponent(accountId)}` : "";
    fetch(`/api/leads/queue${query}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw { message: payload.error ?? "Falha ao montar a fila de leads", reconnect: payload.code === "account_identity_unverified" };
        }
        return payload.data as QueueData;
      })
      .then((payload) => { setData(payload); setSelected(payload.queue[0] ?? null); setError(null); })
      .catch((reason) => {
        if (reason?.name === "AbortError") return;
        setData(null);
        setError({ message: reason?.message ?? "Falha ao montar a fila de leads", reconnect: Boolean(reason?.reconnect) });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [accountId, retry]);

  function changeAccount(value: string) { setLoading(true); setError(null); setAccountId(value); }
  function tryAgain() { setLoading(true); setError(null); setRetry((value) => value + 1); }

  const queue = data?.queue ?? [];
  const uniquePeople = new Set(queue.map((item) => item.commenterId)).size;
  const closingSoon = queue.filter((item) => item.windowOpen && item.hoursLeftInWindow !== null && item.hoursLeftInWindow <= 6).length;
  const awaiting = queue.filter((item) => item.leadStatus === "NOVO").length;
  const inProgress = queue.filter((item) => IN_PROGRESS_LEAD_STATUSES.includes(item.leadStatus)).length;

  return <div className="space-y-7">
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-accent">Priorização comercial</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Quem merece sua atenção agora</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">As DMs em que a última mensagem é da pessoa e ainda não teve resposta, na ordem do prazo: quanto resta da janela de 24h da Meta para você responder.</p></div>
      {accounts.length > 1 && <div className="flex flex-col gap-3 sm:flex-row"><AccountSelect accounts={accounts} value={accountId || data?.account.id || ""} onChange={changeAccount} includeAll={false} /></div>}
    </header>

    {loading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Carregando a fila de leads">{Array.from({ length: 5 }, (_, index) => <div key={index} className="panel h-36 animate-pulse rounded p-5" />)}</div>}

    {!loading && error && <div className="panel flex flex-col items-center rounded p-8 text-center">
      <AlertCircle className="h-8 w-8 text-error" aria-hidden="true" />
      <p className="mt-3 font-semibold">{error.reconnect ? "Reconecte a conta do Instagram" : "Não foi possível montar a fila."}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{error.message}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {error.reconnect && <Link href="/settings" className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Ir para as configurações</Link>}
        <button onClick={tryAgain} className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 text-sm font-semibold text-foreground"><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar novamente</button>
      </div>
    </div>}

    {!loading && data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores da fila">
        <Metric icon={Inbox} label="Sem resposta agora" value={queue.length} helper="Conversas em que a última mensagem é da pessoa." />
        <Metric icon={Users} label="Pessoas na fila" value={uniquePeople} helper="Contadas por perfil, sem repetir quem tem mais de uma conversa." />
        <Metric icon={Clock3} label="Janela fecha em 6h" value={closingSoon} helper="Prazo da janela de 24h da Meta perto do fim." />
        <Metric icon={Search} label="Aguardando abordagem" value={awaiting} helper="Ainda marcadas como “Não abordado” no CRM." />
        <Metric icon={Handshake} label="Em andamento" value={inProgress} helper="Leads que alguém já moveu no CRM e seguem abertos." />
      </section>

      {queue.length === 0 ? <section className="panel rounded p-10 text-center">
        <Inbox className="mx-auto h-9 w-9 text-accent" strokeWidth={1.75} aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold">Nenhuma DM esperando resposta</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">Das {data.conversationsScanned} conversa{data.conversationsScanned === 1 ? "" : "s"} lida{data.conversationsScanned === 1 ? "" : "s"} em @{data.account.username}, em nenhuma a última mensagem é da outra pessoa. Quando alguém escrever e ficar sem resposta, aparece aqui.</p>
        <Link href="/inbox" className="mt-5 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Abrir Oportunidades</Link>
      </section> :
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel overflow-hidden rounded xl:col-span-2" aria-labelledby="fila-resposta">
          <div className="border-b border-border p-5">
            <h2 id="fila-resposta" className="font-semibold">Fila de resposta</h2>
            <p className="mt-1 text-xs text-muted">Ordenada pelo prazo da janela de 24h; seguir a conta e citar palavra-chave só desempatam dentro da faixa. Não é previsão de compra.</p>
          </div>
          <ul className="divide-y divide-border">{queue.map((item) => {
            const deadline = windowLabel(item);
            return <li key={item.key}><button onClick={() => setSelected(item)} className={`grid w-full gap-3 p-4 text-left transition-colors hover:bg-surface-hover sm:grid-cols-[auto_1fr_auto] ${selected?.key === item.key ? "bg-accent-subtle" : ""}`}>
              <span className="text-sm font-semibold tabular-nums text-muted" aria-label={`Posição ${item.position}`}>{item.position}.</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-sm">@{displayName(item)}</strong>
                  <TemperatureBadge temperature={item.temperature} score={item.score} />
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">{LEAD_STATUS_LABEL[item.leadStatus]}</span>
                  {item.matchedKeyword && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted">{item.matchedKeyword}</span>}
                </div>
                {item.lastInboundMessage ? <p className="mt-2 line-clamp-2 text-sm text-muted">“{item.lastInboundMessage}”</p> : <p className="mt-2 text-sm italic text-muted">A última mensagem dessa pessoa não tem texto (mídia ou anexo).</p>}
                <p className="mt-2 text-xs text-muted">{item.lastInboundAt ? `Recebida em ${dateFormat.format(new Date(item.lastInboundAt))}` : "Sem horário devolvido pela Meta"}</p>
              </div>
              <span className={`flex items-center gap-1 self-center text-xs ${deadline.urgent ? "font-semibold text-error" : "text-muted"}`}><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{deadline.text}</span>
            </button></li>;
          })}</ul>
          <p className="border-t border-border p-3 text-center text-xs text-muted">Lidas as {data.conversationsScanned} conversas mais recentes que a Meta devolve para @{data.account.username}.</p>
        </section>

        <aside className="panel h-fit rounded p-5" aria-labelledby="contexto"><h2 id="contexto" className="font-semibold">Por que responder</h2>{selected ? <>
          <p className="mt-1 text-xs text-muted">O que foi observado na conversa com @{displayName(selected)}.</p>
          <ul className="mt-5 space-y-3">{selected.reasons.map((reason) => <li key={reason} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /><span>{reason}</span></li>)}</ul>
          <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5">
            <div><dt className="text-xs text-muted">Janela de 24h</dt><dd className="mt-1 text-sm font-semibold">{selected.hoursLeftInWindow === null ? "—" : selected.windowOpen ? formatHours(selected.hoursLeftInWindow) : "fechada"}</dd></div>
            <div><dt className="text-xs text-muted">Segue a conta</dt><dd className="mt-1 text-sm font-semibold">{selected.followsAccount === null ? "—" : selected.followsAccount ? "Sim" : "Não"}</dd></div>
            <div><dt className="text-xs text-muted">Estado no CRM</dt><dd className="mt-1 text-sm font-semibold">{LEAD_STATUS_LABEL[selected.leadStatus]}</dd></div>
            <div><dt className="text-xs text-muted">Último contato</dt><dd className="mt-1 text-sm font-semibold">{selected.lastContactedAt ? dateFormat.format(new Date(selected.lastContactedAt)) : "—"}</dd></div>
          </dl>
          {selected.followsAccount === null && <p className="mt-3 text-xs text-muted">“—” em “Segue a conta”: a Meta não respondeu essa consulta. Não quer dizer que a pessoa não segue.</p>}
          {selected.leadNote && <p className="mt-3 rounded border border-border bg-surface-hover p-3 text-xs leading-5 text-muted">{selected.leadNote}</p>}
          <Link href="/inbox" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Responder em Oportunidades<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
        </> : <p className="mt-4 text-sm text-muted">Selecione uma pessoa para ver os sinais.</p>}</aside>
      </div>}

      {data.keywordSource === "default" && <p className="flex items-start gap-2 text-xs leading-5 text-muted"><MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sem automações configuradas, as palavras-chave destacadas vêm de um vocabulário comercial padrão — nenhuma pessoa entra ou sai da fila por causa delas.</p>}
    </>}

    <aside className="rounded border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">A ordem é uma sugestão baseada em DMs recebidas e no prazo da janela de 24h da Meta. Não garante interesse, resposta ou compra. Esta tela lê apenas mensagens diretas: comentários não entram aqui. Vendas só devem contar após confirmação manual, por CRM ou checkout.</aside>
  </div>;
}
