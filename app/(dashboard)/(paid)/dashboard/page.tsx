"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatusBadge from "@/components/status-badge";
import { ChevronDown, MessageCircle } from "lucide-react";

interface DashboardStats {
  userName: string | null;
  intentCommentsMonth: number;
  contactsCount: number;
  dmsDeliveredMonth: number;
  clicksThisMonth: number;
  advanceRateMonth: number | null;
  advanceRateFromComments?: number | null;
  activeAutomations: number;
  instagramAccounts: AccountOption[];
  comparisons: {
    intentComments: number | null;
    uniqueContacts: number | null;
    dmsDelivered: number | null;
    clicks: number | null;
    advanceRate: number | null;
  };
  comparisonPeriod: { currentLabel: string; previousLabel: string };
  operationalHealth: { delivered: number; skipped: number; failed: number };
  topKeywords: { keyword: string; count: number }[];
  dailyIntentComments: { date: string; count: number }[];
  recentLogs: Array<{
    id: string;
    commenterName: string | null;
    commentText: string;
    matchedKeyword: string | null;
    status: string;
    createdAt: string;
    automation: { name: string };
    instagramAccount?: { username: string };
  }>;
}

/** Taxa nunca medida (`null`/ausente) é exibida como travessão, distinta de um zero medido. */
function formatRate(value: number | null | undefined) {
  return value == null ? "—" : `${value}%`;
}

function Trend({ value, points = false }: { value: number | null | undefined; points?: boolean }) {
  if (value == null) return <span className="text-xs text-muted">sem histórico</span>;
  const positive = value >= 0;
  return (
    <span className={`text-xs font-medium ${positive ? "text-success" : "text-error"}`}>
      {positive ? "+" : ""}{value}{points ? " p.p." : "%"}
    </span>
  );
}

function MetricCard({ label, value, trend, points, helper }: {
  label: string; value: string | number; trend: number | null | undefined; points?: boolean; helper: string;
}) {
  return (
    <div className="panel rounded p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <Trend value={trend} points={points} />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") params.set("instagramAccountId", selectedAccountId);
    fetch(`/api/dashboard/stats${params.size ? `?${params}` : ""}`)
      .then((response) => response.json())
      .then((payload) => { if (payload.success) setStats(payload.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  if (loading) {
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className="panel h-36 rounded p-5" />)}</div>;
  }
  if (!stats) return <div className="panel rounded p-8 text-sm text-error">Não foi possível carregar os indicadores.</div>;

  const semAtividade = stats.intentCommentsMonth === 0 && stats.activeAutomations === 0;
  const maxIntent = Math.max(...stats.dailyIntentComments.map((day) => day.count), 1);
  const deliveryRate = stats.intentCommentsMonth > 0
    ? Math.min(100, Number(((stats.dmsDeliveredMonth / stats.intentCommentsMonth) * 100).toFixed(1)))
    : null;
  // Todas as etapas usam o mesmo denominador: comentários acionados.
  const funnel: Array<{ label: string; value: number; rate: number | null }> = [
    { label: "Comentários acionados", value: stats.intentCommentsMonth, rate: 100 },
    { label: "DMs enviadas", value: stats.dmsDeliveredMonth, rate: deliveryRate },
    { label: "Cliques brutos", value: stats.clicksThisMonth, rate: stats.advanceRateFromComments ?? null },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Central de crescimento comercial</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Olá, {stats.userName ?? "bem-vindo"}.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Acompanhe pessoas que demonstraram intenção nos comentários e leve as conversas mais quentes para a abordagem individual.</p>
        </div>
        {stats.instagramAccounts.length > 1 && <AccountSelect accounts={stats.instagramAccounts} value={selectedAccountId} onChange={handleAccountChange} />}
      </header>

      {semAtividade ? (
        <section className="panel rounded p-10 text-center">
          <MessageCircle className="mx-auto h-9 w-9 text-accent" strokeWidth={1.75} aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhuma automação ativa ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Os indicadores começam a aparecer quando um comentário acionar uma automação. Ainda não há nada medido por aqui.</p>
          <Link href="/campaigns/new" className="mt-5 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Criar automação de vendas</Link>
        </section>
      ) : (
        <>
      <section aria-labelledby="metricas-comerciais">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="metricas-comerciais" className="text-base font-semibold text-foreground">Crescimento do funil</h2>
            <p className="mt-1 text-xs text-muted">Comparação: {stats.comparisonPeriod.currentLabel} versus {stats.comparisonPeriod.previousLabel}.</p>
          </div>
          <p className="text-xs text-muted">Comentário acionado = interação em post ou reel que disparou uma automação.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Comentários acionados" value={stats.intentCommentsMonth} trend={stats.comparisons.intentComments} helper="Comentários que dispararam uma automação neste mês." />
          <MetricCard label="Contatos únicos" value={stats.contactsCount} trend={stats.comparisons.uniqueContacts} helper="Pessoas únicas entre os comentários acionados." />
          <MetricCard label="DMs enviadas" value={stats.dmsDeliveredMonth} trend={stats.comparisons.dmsDelivered} helper="Mensagens marcadas como enviadas pela Meta." />
          <MetricCard label="Cliques" value={stats.clicksThisMonth} trend={stats.comparisons.clicks} helper="Acessos registrados; pode incluir repetições." />
          <MetricCard label="Relação clique/DM" value={formatRate(stats.advanceRateMonth)} trend={stats.comparisons.advanceRate} points helper="Cliques ÷ DMs enviadas; não representa venda." />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="panel rounded p-5 lg:col-span-3" aria-labelledby="evolucao-intencao">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="evolucao-intencao" className="text-base font-semibold text-foreground">Evolução dos comentários acionados</h2><p className="mt-1 text-xs text-muted">Volume diário no mês atual.</p></div>
            <Link href="/logs" className="text-sm font-medium text-accent hover:underline">Ver contatos</Link>
          </div>
          <div className="mt-7 flex h-52 items-end gap-1 overflow-hidden sm:gap-1.5">
            {stats.dailyIntentComments.map((day, index) => (
              <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${day.date}: ${day.count}`}>
                <span className="text-[10px] font-medium text-muted">{day.count}</span>
                <div className="w-full rounded-t bg-accent" style={{ height: `${Math.max((day.count / maxIntent) * 150, 3)}px` }} />
                {(index === 0 || index === stats.dailyIntentComments.length - 1 || index % 5 === 0) && <span className="w-full truncate text-center text-[9px] text-muted">{day.date}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded p-5 lg:col-span-2" aria-labelledby="funil-avanco">
          <h2 id="funil-avanco" className="text-base font-semibold text-foreground">Indicadores da automação</h2>
          <p className="mt-1 text-xs text-muted">Volumes relacionados, sem atribuição individual de venda.</p>
          <div className="mt-6 space-y-5">
            {funnel.map((step, index) => (
              <div key={step.label}>
                <div className="mb-2 flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-foreground">{step.label}</p><p className="text-xs text-muted">{formatRate(step.rate)} da etapa inicial</p></div><strong className="text-xl text-foreground">{step.value}</strong></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-hover"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(step.rate ?? 0, 100)}%` }} /></div>
                {index < funnel.length - 1 && <ChevronDown className="mx-auto mt-2 h-4 w-4 text-muted" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel rounded p-5 lg:col-span-2" aria-labelledby="fila-comercial">
          <div className="flex items-start justify-between gap-4"><div><h2 id="fila-comercial" className="text-base font-semibold text-foreground">Sinais recentes para abordagem</h2><p className="mt-1 text-xs text-muted">Priorize comentários com contexto comercial e continue a conversa no 1:1.</p></div><Link href="/inbox" className="shrink-0 rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover">Abrir caixa de entrada</Link></div>
          <div className="mt-5 divide-y divide-border">
            {stats.recentLogs.length === 0 && <p className="py-8 text-center text-sm text-muted">Nenhum comentário acionou uma automação neste mês.</p>}
            {stats.recentLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">@{log.commenterName ?? "contato"} <span className="font-normal text-muted">· {log.matchedKeyword}</span></p><p className="mt-1 truncate text-xs text-muted">“{log.commentText}” · {log.automation.name}</p></div>
                <StatusBadge status={log.status} />
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="panel rounded p-5" aria-labelledby="palavras-chave"><h2 id="palavras-chave" className="text-base font-semibold text-foreground">Palavras-chave mais acionadas</h2><div className="mt-4 space-y-3">{stats.topKeywords.length === 0 && <p className="text-sm text-muted">Ainda sem dados.</p>}{stats.topKeywords.map((item, index) => <div key={item.keyword} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-foreground">{index + 1}. {item.keyword}</span><strong className="text-foreground">{item.count}</strong></div>)}</div></section>
          <section className="panel rounded p-5" aria-labelledby="saude-operacional"><h2 id="saude-operacional" className="text-base font-semibold text-foreground">Saúde operacional</h2><p className="mt-1 text-xs text-muted">Separada dos indicadores comerciais.</p><dl className="mt-4 grid grid-cols-3 gap-3 text-center"><div><dt className="text-xs text-muted">Entregues</dt><dd className="mt-1 text-lg font-semibold text-success">{stats.operationalHealth.delivered}</dd></div><div><dt className="text-xs text-muted">Ignoradas</dt><dd className="mt-1 text-lg font-semibold text-warning">{stats.operationalHealth.skipped}</dd></div><div><dt className="text-xs text-muted">Falhas</dt><dd className="mt-1 text-lg font-semibold text-error">{stats.operationalHealth.failed}</dd></div></dl><Link href="/diagnostics" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">Ver diagnóstico</Link></section>
        </div>
      </div>
        </>
      )}

      <aside className="rounded border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">Este painel não afirma oportunidades, vendas ou receita: esses eventos ainda não são registrados pela plataforma. “Enviada” não comprova leitura; cliques são brutos e não comprovam compra.</aside>
    </div>
  );
}
