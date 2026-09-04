"use client";

import { useEffect, useState } from "react";
import { BadgeDollarSign, CircleGauge, Target, Trophy } from "lucide-react";
import {
  COMMERCIAL_STATUS_LABEL,
  type CommercialResults,
  type MeasurementStatus,
} from "@/lib/crm/client-types";

const COVERAGE_LABEL: Record<MeasurementStatus, string> = {
  measured: "Período medido",
  partial: "Medição parcial",
  unavailable: "Dados indisponíveis",
};

function displayNumber(value: number | null) {
  return value == null ? "—" : value.toLocaleString("pt-BR");
}

function displayPeriod(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(from))} a ${formatter.format(new Date(to))} (UTC)`;
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Target;
}) {
  return (
    <article className="panel rounded p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
    </article>
  );
}

export default function ResultsPage() {
  const [days, setDays] = useState("30");
  const [instagramAccountId, setInstagramAccountId] = useState("all");
  const [sourceAutomationId, setSourceAutomationId] = useState("all");
  const [accounts, setAccounts] = useState<Array<{ id: string; username: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; instagramAccountId: string }>>([]);
  const [data, setData] = useState<CommercialResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/dashboard/stats", { cache: "no-store", signal: controller.signal }).then((response) => response.json()),
      fetch("/api/automations", { cache: "no-store", signal: controller.signal }).then((response) => response.json()),
    ])
      .then(([statsPayload, campaignsPayload]) => {
        if (statsPayload.success) {
          setAccounts(
            (statsPayload.data.instagramAccounts ?? []).map(
              (account: { id: string; username: string }) => ({
                id: account.id,
                username: account.username,
              })
            )
          );
        }
        if (campaignsPayload.success) {
          setCampaigns(
            (campaignsPayload.data ?? []).map(
              (campaign: { id: string; name: string; instagramAccountId: string }) => ({
                id: campaign.id,
                name: campaign.name,
                instagramAccountId: campaign.instagramAccountId,
              })
            )
          );
        }
      })
      .catch(() => {
        // Measurement remains usable when optional filter metadata is unavailable.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const to = new Date();
      const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      if (instagramAccountId !== "all") params.set("instagramAccountId", instagramAccountId);
      if (sourceAutomationId !== "all") params.set("sourceAutomationId", sourceAutomationId);
      setLoading(true);
      setError(null);
      setData(null);
      fetch(`/api/results?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.error ?? "Não foi possível carregar os resultados");
          setData(payload.data);
        })
        .catch((loadError) => {
          if (loadError instanceof DOMException && loadError.name === "AbortError") return;
          setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os resultados");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [days, instagramAccountId, sourceAutomationId]);

  const visibleCampaigns = campaigns.filter(
    (campaign) =>
      instagramAccountId === "all" || campaign.instagramAccountId === instagramAccountId
  );

  function changeAccount(nextAccountId: string) {
    setInstagramAccountId(nextAccountId);
    if (
      sourceAutomationId !== "all" &&
      !campaigns.some(
        (campaign) =>
          campaign.id === sourceAutomationId &&
          (nextAccountId === "all" || campaign.instagramAccountId === nextAccountId)
      )
    ) {
      setSourceAutomationId("all");
    }
  }

  const status = data?.coverage.status ?? "unavailable";
  const revenue = data?.metrics.revenue.byCurrency;
  const maxStage = Math.max(...(data?.metrics.pipeline.stages ?? []).map((stage) => stage.count), 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Mensuração comercial</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Resultados</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Somente eventos persistidos entram aqui. Clique é sinal; venda exige confirmação.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">Período
            <select value={days} onChange={(event) => setDays(event.target.value)} className="mt-1 min-h-11 w-full rounded border border-border bg-surface px-3 text-sm">
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 365 dias</option>
            </select>
          </label>
          <label className="text-sm font-medium">Conta
            <select value={instagramAccountId} onChange={(event) => changeAccount(event.target.value)} className="mt-1 min-h-11 w-full rounded border border-border bg-surface px-3 text-sm">
              <option value="all">Todas</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>@{account.username}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Campanha
            <select value={sourceAutomationId} onChange={(event) => setSourceAutomationId(event.target.value)} className="mt-1 min-h-11 w-full rounded border border-border bg-surface px-3 text-sm">
              <option value="all">Todas</option>
              {visibleCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      {error && <div role="alert" className="rounded border border-error-subtle-border bg-error-subtle p-4 text-sm text-error">{error}</div>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-36 rounded" />)}</div>
      ) : data ? (
        <>
          <section className={`rounded border p-4 ${status === "measured" ? "border-success-subtle-border bg-success-subtle" : status === "partial" ? "border-warning-subtle-border bg-warning-subtle" : "border-border bg-surface-subtle"}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{COVERAGE_LABEL[status]}</p>
                <p className="mt-1 text-xs text-muted">
                  {status === "measured" && "A instrumentação começou antes do recorte; a cobertura presume que ela permaneceu contínua."}
                  {status === "partial" && `A medição começou em ${data.coverage.firstMeasuredAt ? `${new Date(data.coverage.firstMeasuredAt).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC` : "data não identificada"}; o início não está coberto e a continuidade posterior é uma premissa.`}
                  {status === "unavailable" && "Ainda não existem eventos comerciais instrumentados para este período. “—” não significa zero."}
                </p>
              </div>
              <p className="text-xs text-muted">Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC</p>
            </div>
            <p className="mt-2 text-xs text-muted">Recorte efetivo: {displayPeriod(data.period.from, data.period.to)}</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores comerciais">
            <MetricCard label="Oportunidades criadas" value={displayNumber(data.metrics.opportunities.value)} helper="Contatos com evento de entrada no período." icon={Target} />
            <MetricCard label="Oportunidades qualificadas" value={displayNumber(data.metrics.qualified.value)} helper="Classificação atual: preço, compra, urgência ou interesse forte." icon={CircleGauge} />
            <MetricCard label="Vendas registradas" value={displayNumber(data.metrics.wins.value)} helper="Oportunidades criadas no recorte com venda confirmada no mesmo recorte." icon={Trophy} />
            <MetricCard label="Conversão confirmada" value={data.metrics.conversion.value == null ? "—" : `${(data.metrics.conversion.value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} helper={data.metrics.conversion.reason === "zero_denominator" ? "Foram medidas 0 oportunidades criadas; não há taxa a calcular." : "Oportunidades da coorte com venda confirmada ÷ oportunidades criadas."} icon={BadgeDollarSign} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel rounded p-4 sm:p-6">
              <h2 className="text-base font-semibold">Receita confirmada</h2>
              <p className="mt-1 text-xs text-muted">Valores são separados por moeda e nunca somados entre si.</p>
              <div className="mt-5 space-y-3">
                {revenue == null && <p className="rounded bg-surface-subtle p-4 text-sm text-muted">Dados indisponíveis para o período.</p>}
                {revenue?.length === 0 && <p className="rounded bg-surface-subtle p-4 text-sm text-muted">Medição ativa, sem vendas confirmadas no período.</p>}
                {revenue?.map((row) => (
                  <div key={row.currency} className="flex items-end justify-between gap-4 rounded border border-border p-4">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">{row.currency}</p><p className="mt-1 text-2xl font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: row.currency }).format(row.amountCents / 100)}</p></div>
                    <p className="text-xs text-muted">{row.confirmedSales} venda(s)</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel rounded p-4 sm:p-6">
              <h2 className="text-base font-semibold">Pipeline no período</h2>
              <p className="mt-1 text-xs text-muted">Etapa atual das oportunidades criadas no recorte.</p>
              <div className="mt-5 space-y-4">
                {data.metrics.pipeline.stages == null && <p className="rounded bg-surface-subtle p-4 text-sm text-muted">Pipeline indisponível para este período.</p>}
                {data.metrics.pipeline.stages?.map((stage) => (
                  <div key={stage.stage}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span>{COMMERCIAL_STATUS_LABEL[stage.stage]}</span><strong>{stage.count}</strong></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max((stage.count / maxStage) * 100, stage.count > 0 ? 4 : 0)}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="rounded border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">
            Receita confirmada inclui todas as vendas confirmadas no recorte, inclusive de oportunidades mais antigas. A taxa de conversão usa apenas a coorte criada no recorte. Valor potencial, mensagens e cliques ficam fora de ambos os cálculos.
          </aside>
        </>
      ) : null}
    </div>
  );
}
