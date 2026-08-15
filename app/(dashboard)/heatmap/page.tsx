"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { AlertCircle, ArrowUpRight, Clock3, Flame, MessageCircle, RefreshCw, Search, Send, Users } from "lucide-react";

type Period = "24h" | "7d" | "30d" | "90d";
interface QueueItem { key: string; instagramUsername: string; commenterId: string; commenterName: string | null; latestComment: string; latestKeyword: string | null; automationName: string; lastSeenAt: string; signalCount: number; sentCount: number; priorityLabel: string; reasons: string[] }
interface HeatmapData { accounts: AccountOption[]; queue: QueueItem[]; truncated: boolean; metrics: { triggeredComments: number; uniquePeople: number; awaitingReview: number; automaticDmsSent: number } }

const periods: Array<{ value: Period; label: string }> = [{ value: "24h", label: "24 horas" }, { value: "7d", label: "7 dias" }, { value: "30d", label: "30 dias" }, { value: "90d", label: "90 dias" }];

function Metric({ label, value, helper, icon: Icon }: { label: string; value: number; helper: string; icon: typeof Flame }) {
  return <div className="panel rounded p-5"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-muted">{label}</p><Icon className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden="true" /></div><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs leading-5 text-muted">{helper}</p></div>;
}

export default function HeatmapPage() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [period, setPeriod] = useState<Period>("7d");
  const [accountId, setAccountId] = useState("all");
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ period });
    if (accountId !== "all") params.set("instagramAccountId", accountId);
    fetch(`/api/heatmap/overview?${params}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Falha"); return response.json(); })
      .then((payload) => { setData(payload.data); setSelected(payload.data.queue[0] ?? null); })
      .catch((reason) => { if (reason.name !== "AbortError") setError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period, accountId, retry]);

  function changePeriod(value: Period) { setLoading(true); setError(false); setPeriod(value); }
  function changeAccount(value: string) { setLoading(true); setError(false); setAccountId(value); }
  function tryAgain() { setLoading(true); setError(false); setRetry((value) => value + 1); }

  return <div className="space-y-7">
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-accent">Priorização comercial</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Quem merece sua atenção agora</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Uma fila baseada em comentários e sinais que a Comentou realmente observou, para você decidir onde iniciar uma conversa 1:1.</p></div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {data && data.accounts.length > 1 && <AccountSelect accounts={data.accounts} value={accountId} onChange={changeAccount} />}
        <label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-muted">Período</span><select value={period} onChange={(event) => changePeriod(event.target.value as Period)} className="min-w-40 rounded-xl border border-border bg-surface px-3 py-2 text-foreground">{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
    </header>

    {loading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Carregando mapa de calor">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-36 animate-pulse rounded p-5" />)}</div>}
    {error && <div className="panel flex flex-col items-center rounded p-8 text-center"><AlertCircle className="h-8 w-8 text-error" aria-hidden="true" /><p className="mt-3 font-semibold">Não foi possível carregar os sinais.</p><button onClick={tryAgain} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded bg-accent px-4 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Tentar novamente</button></div>}
    {!loading && data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do período">
        <Metric icon={MessageCircle} label="Comentários acionados" value={data.metrics.triggeredComments} helper="Comentários distintos que dispararam automações." />
        <Metric icon={Users} label="Pessoas únicas" value={data.metrics.uniquePeople} helper="Identidades separadas por conta do Instagram." />
        <Metric icon={Search} label="Na fila de revisão" value={data.metrics.awaitingReview} helper="Pessoas com contexto recente para revisar." />
        <Metric icon={Send} label="DMs automáticas enviadas" value={data.metrics.automaticDmsSent} helper="Envios registrados; não comprova leitura ou resposta." />
      </section>

      {data.queue.length === 0 ? <section className="panel rounded p-10 text-center"><Flame className="mx-auto h-9 w-9 text-accent" strokeWidth={1.75} /><h2 className="mt-4 text-lg font-semibold">Ainda não há sinais neste período</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted">Quando um comentário acionar uma automação, ele aparecerá aqui para revisão.</p><Link href="/campaigns/new" className="mt-5 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-semibold text-white">Criar automação de vendas</Link></section> :
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel overflow-hidden rounded xl:col-span-2" aria-labelledby="fila-revisao"><div className="border-b border-border p-5"><h2 id="fila-revisao" className="font-semibold">Fila de revisão</h2><p className="mt-1 text-xs text-muted">Ordenada por palavra-chave, recorrência e recência. Não é previsão de compra.</p></div><div className="divide-y divide-border">{data.queue.map((item) => <button key={item.key} onClick={() => setSelected(item)} className={`grid w-full gap-3 p-4 text-left transition-colors hover:bg-surface-hover sm:grid-cols-[1fr_auto] ${selected?.key === item.key ? "bg-blue-50" : ""}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">@{item.commenterName ?? item.commenterId.slice(0, 10)}</strong><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{item.priorityLabel}</span>{item.latestKeyword && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted">{item.latestKeyword}</span>}</div><p className="mt-2 line-clamp-2 text-sm text-muted">“{item.latestComment}”</p><p className="mt-2 text-xs text-muted">@{item.instagramUsername} · {item.automationName} · {item.signalCount} sinal(is)</p></div><span className="flex items-center gap-1 self-center text-xs text-muted"><Clock3 className="h-3.5 w-3.5" />{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.lastSeenAt))}</span></button>)}</div>{data.truncated && <p className="border-t border-border p-3 text-center text-xs text-muted">Mostrando a amostra mais recente de 500 eventos.</p>}</section>
        <aside className="panel h-fit rounded p-5" aria-labelledby="contexto"><h2 id="contexto" className="font-semibold">Por que revisar</h2>{selected ? <><p className="mt-1 text-xs text-muted">Evidências observadas para @{selected.commenterName ?? selected.commenterId.slice(0, 10)}.</p><ul className="mt-5 space-y-3">{selected.reasons.map((reason) => <li key={reason} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /><span>{reason}</span></li>)}</ul><dl className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5"><div><dt className="text-xs text-muted">Sinais</dt><dd className="mt-1 text-lg font-semibold">{selected.signalCount}</dd></div><div><dt className="text-xs text-muted">DMs enviadas</dt><dd className="mt-1 text-lg font-semibold">{selected.sentCount}</dd></div></dl><Link href="/inbox" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Revisar contexto<ArrowUpRight className="h-4 w-4" /></Link></> : <p className="mt-4 text-sm text-muted">Selecione uma pessoa para ver os sinais.</p>}</aside>
      </div>}
    </>}
    <aside className="rounded border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">A prioridade é uma sugestão baseada em interações observadas. Não garante interesse, resposta ou compra. DMs automáticas, cliques e vendas são eventos diferentes; vendas só devem contar após confirmação manual, por CRM ou checkout.</aside>
  </div>;
}
