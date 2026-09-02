"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleUserRound,
  Flame,
  MessagesSquare,
  Stethoscope,
} from "lucide-react";
import {
  COMMERCIAL_STATUS_LABEL,
  INTENT_LABEL,
  type Opportunity,
} from "@/lib/crm/client-types";

interface DiagnosticsSummary {
  workerHealth: { healthy: boolean };
  webhookFailures: unknown[];
  dmFailures: unknown[];
  tokenRefreshFailures: unknown[];
}

interface NowSummary {
  counts: {
    totalOpen: number;
    newLeads: number;
    unassigned: number;
    overdue: number;
    stalled: number;
    hot: number;
  };
  coverage: "exact";
  generatedAt: string;
}

type ActionCard = {
  label: string;
  count: number | "—";
  helper: string;
  href: string;
  icon: typeof Flame;
  tone: "blue" | "amber" | "red";
};

const HOT_INTENTS = new Set(["PRICE", "PURCHASE", "URGENCY", "STRONG_INTEREST"]);

const TONE_CLASS: Record<ActionCard["tone"], string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
};

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [summary, setSummary] = useState<NowSummary | null>(null);
  const [opportunityHasMore, setOpportunityHasMore] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const diagnosticsRequest = fetch("/api/admin/diagnostics", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      })
      .catch(() => null);

    async function load() {
      try {
        const [opportunitiesResponse, summaryResponse] = await Promise.all([
          fetch("/api/opportunities?limit=100", { cache: "no-store" }),
          fetch("/api/opportunities/summary", { cache: "no-store" }),
        ]);
        const [opportunitiesPayload, summaryPayload] = await Promise.all([
          opportunitiesResponse.json().catch(() => null),
          summaryResponse.json().catch(() => null),
        ]);

        if (!opportunitiesResponse.ok || !opportunitiesPayload?.success) {
          throw new Error(
            opportunitiesPayload?.error ?? "Não foi possível carregar a fila comercial"
          );
        }
        if (!summaryResponse.ok || !summaryPayload?.success) {
          throw new Error(
            summaryPayload?.error ?? "Não foi possível calcular as prioridades comerciais"
          );
        }
        if (!active) return;

        setOpportunities(opportunitiesPayload.data.items);
        setOpportunityHasMore(Boolean(opportunitiesPayload.data.page?.hasMore));
        setSummary(summaryPayload.data);
        setLoadedAt(
          Number.isNaN(Date.parse(summaryPayload.data.generatedAt))
            ? Date.now()
            : Date.parse(summaryPayload.data.generatedAt)
        );
        setError(null);

        void diagnosticsRequest.then((diagnosticsPayload) => {
          if (active && diagnosticsPayload?.success) {
            setDiagnostics(diagnosticsPayload.data);
          }
        });
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar a central"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const insights = useMemo(() => {
    const now = loadedAt ?? 0;
    const open = opportunities.filter((item) => item.status !== "GANHO" && item.status !== "PERDIDO");
    const technicalRecentCount = diagnostics
      ? diagnostics.webhookFailures.length + diagnostics.dmFailures.length + diagnostics.tokenRefreshFailures.length + (diagnostics.workerHealth.healthy ? 0 : 1)
      : null;

    const cards: ActionCard[] = [
      { label: "Novos interessados", count: summary?.counts.newLeads ?? "—", helper: "Ainda sem primeira abordagem", href: "/opportunities?status=NOVO", icon: CircleUserRound, tone: "blue" },
      { label: "Sem responsável", count: summary?.counts.unassigned ?? "—", helper: "Precisam entrar em uma fila", href: "/opportunities", icon: MessagesSquare, tone: "amber" },
      { label: "Follow-ups vencidos", count: summary?.counts.overdue ?? "—", helper: "Prazo da próxima ação expirou", href: "/opportunities", icon: CalendarClock, tone: summary?.counts.overdue ? "red" : "blue" },
      { label: "Negociações paradas", count: summary?.counts.stalled ?? "—", helper: "Sem mudança há mais de 3 dias", href: "/opportunities?status=NEGOCIANDO", icon: AlertTriangle, tone: summary?.counts.stalled ? "amber" : "blue" },
      { label: "Sinais quentes", count: summary?.counts.hot ?? "—", helper: "Preço, compra, urgência ou interesse forte", href: "/opportunities", icon: Flame, tone: "amber" },
      { label: "Alertas técnicos", count: "—", helper: technicalRecentCount == null ? "Indisponível para este acesso" : technicalRecentCount > 0 ? `${technicalRecentCount} alertas recentes; total não exibido` : "Nenhum alerta no recorte recente", href: "/diagnostics", icon: Stethoscope, tone: technicalRecentCount && technicalRecentCount > 0 ? "red" : "blue" },
    ];

    const ranked = [...open].sort((a, b) => {
      const priority = (item: Opportunity) => {
        let score = item.status === "NOVO" ? 5 : 0;
        if (!item.assignee) score += 4;
        if (item.commercial.nextActionAt && new Date(item.commercial.nextActionAt).getTime() < now) score += 6;
        if (item.intent.category && HOT_INTENTS.has(item.intent.category)) score += 3;
        if (item.status === "NEGOCIANDO" && new Date(item.updatedAt).getTime() < now - 3 * 24 * 60 * 60 * 1000) score += 4;
        return score;
      };
      return priority(b) - priority(a) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return { cards, ranked: ranked.slice(0, 8) };
  }, [diagnostics, loadedAt, opportunities, summary]);

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="panel h-36 rounded" />)}</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Central Agora</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">O que precisa da sua atenção agora?</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Ações comerciais primeiro. Indicadores de conteúdo ficam em uma área separada.</p>
        </div>
        <Link href="/opportunities" className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
          Abrir pipeline <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-error">
          {error}. Os totais não estão disponíveis agora.
          <button type="button" onClick={() => window.location.reload()} className="ml-2 font-semibold underline">Tentar novamente</button>
        </div>
      )}

      {!error && summary?.counts.totalOpen === 0 ? (
        <section className="panel rounded p-8 text-center sm:p-12">
          <MessagesSquare className="mx-auto h-10 w-10 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Sua fila comercial ainda está vazia</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Quando um comentário ou Direct for observado, a oportunidade aparecerá aqui com origem e intenção. Nenhum resultado comercial foi medido ainda.</p>
          <Link href="/campaigns/new" className="mt-5 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Criar primeira campanha</Link>
        </section>
      ) : !error && summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Prioridades comerciais">
            {insights.cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={card.href} className="panel group rounded p-5 transition hover:border-border-hover">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm font-medium text-muted">{card.label}</p><p className="mt-3 text-3xl font-semibold text-foreground">{card.count}</p></div>
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded border ${TONE_CLASS[card.tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  </div>
                  <p className="mt-3 text-xs text-muted">{card.helper}</p>
                </Link>
              );
            })}
          </section>

          <section className="panel rounded p-4 sm:p-6" aria-labelledby="proximas-acoes">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 id="proximas-acoes" className="text-base font-semibold">Próximas melhores ações</h2><p className="mt-1 text-xs text-muted">Ordem explicável: prazo vencido, sem responsável, etapa e sinal de intenção.</p></div>
              <Link href="/opportunities" className="text-sm font-semibold text-accent hover:underline">Ver todas</Link>
            </div>
            {opportunityHasMore && (
              <p role="status" className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                Os cartões usam totais exatos. A lista abaixo prioriza somente as 100 oportunidades mais recentes; abra o pipeline para consultar as demais.
              </p>
            )}
            <div className="mt-5 divide-y divide-border">
              {insights.ranked.length === 0 && (
                <p className="py-6 text-sm text-muted">Há oportunidades abertas fora deste recorte recente. Abra o pipeline para ver a fila completa.</p>
              )}
              {insights.ranked.map((item) => {
                const overdue = item.commercial.nextActionAt && loadedAt != null && new Date(item.commercial.nextActionAt).getTime() < loadedAt;
                return (
                  <article key={item.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_160px_160px_40px] md:items-center">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">@{item.person.name ?? item.person.id}</p><p className="mt-1 truncate text-xs text-muted">{item.origin.text ?? "Texto de origem indisponível"}</p></div>
                    <div><p className="text-xs text-muted">{COMMERCIAL_STATUS_LABEL[item.status]}</p><p className="mt-1 text-xs font-medium text-foreground">{INTENT_LABEL[item.intent.category ?? "UNKNOWN"]}</p></div>
                    <div><p className={`text-xs ${overdue ? "font-semibold text-error" : "text-muted"}`}>{item.commercial.nextAction ?? (item.assignee ? "Definir próxima ação" : "Atribuir responsável")}</p>{item.commercial.nextActionAt && <p className="mt-1 text-xs text-muted">{new Date(item.commercial.nextActionAt).toLocaleString("pt-BR")}</p>}</div>
                    <Link href={`/opportunities/${item.id}`} aria-label={`Abrir oportunidade de ${item.person.name ?? item.person.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded text-accent hover:bg-blue-50"><ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      <aside className="rounded border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">A central usa apenas oportunidades persistidas e alertas do workspace. Ela não infere faturamento por mensagens ou cliques.</aside>
    </div>
  );
}
