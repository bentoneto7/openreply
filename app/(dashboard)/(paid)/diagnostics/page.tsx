"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ServerCog,
} from "lucide-react";
import type { Opportunity } from "@/lib/crm/client-types";

interface DiagnosticsData {
  queueCounts: Record<string, number> | null;
  queueCountsReason: string | null;
  workerHealth: {
    healthy: boolean;
    ageMs: number | null;
    heartbeat: { checkedAt: string; hostname?: string; pid: number; startedAt?: string } | null;
  };
  workerAlerts: Array<{ level: string; message: string; createdAt: string }>;
  webhookFailures: Array<{ id: string; object: string | null; errorMessage: string | null; createdAt: string }>;
  dmFailures: Array<{ id: string; status: string; commentId: string; commentText: string; errorMessage: string | null; updatedAt: string; automation: { name: string } }>;
  tokenRefreshFailures: Array<{ id: string; message: string; createdAt: string }>;
  operationalEvents: Array<{ id: string; source: string; level: string; message: string; createdAt: string; resolvedAt: string | null }>;
}

type Issue = {
  title: string;
  impact: string;
  cause: string;
  action: string;
  href: string;
  severity: "warning" | "error";
};

function Metric({ label, value, helper, alert = false }: { label: string; value: string | number; helper: string; alert?: boolean }) {
  return (
    <article className="panel rounded p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${alert ? "text-error" : "text-foreground"}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
    </article>
  );
}

export default function DiagnosticsPage() {
  const [technical, setTechnical] = useState<DiagnosticsData | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [technicalForbidden, setTechnicalForbidden] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [technicalResponse, opportunitiesResponse] = await Promise.all([
        fetch("/api/admin/diagnostics", { cache: "no-store" }),
        fetch("/api/opportunities?limit=100", { cache: "no-store" }),
      ]);
      const [technicalPayload, opportunitiesPayload] = await Promise.all([
        technicalResponse.json(),
        opportunitiesResponse.json(),
      ]);
      if (!opportunitiesResponse.ok || !opportunitiesPayload.success) {
        throw new Error(opportunitiesPayload.error ?? "Não foi possível carregar a saúde comercial");
      }
      setOpportunities(opportunitiesPayload.data.items);
      if (technicalResponse.status === 403) {
        setTechnicalForbidden(true);
        setTechnical(null);
      } else if (!technicalResponse.ok || !technicalPayload.success) {
        throw new Error(technicalPayload.error ?? "Não foi possível carregar a saúde técnica");
      } else {
        setTechnicalForbidden(false);
        setTechnical(technicalPayload.data);
      }
      setLoadedAt(Date.now());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o diagnóstico");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const commercial = useMemo(() => {
    const now = loadedAt ?? 0;
    const open = opportunities.filter((item) => item.status !== "GANHO" && item.status !== "PERDIDO");
    return {
      unassigned: open.filter((item) => !item.assignee).length,
      unanswered: open.filter((item) => item.status === "NOVO").length,
      overdue: open.filter((item) => item.commercial.nextActionAt && new Date(item.commercial.nextActionAt).getTime() < now).length,
      stalled: open.filter((item) => item.status === "NEGOCIANDO" && new Date(item.updatedAt).getTime() < now - 3 * 24 * 60 * 60 * 1000).length,
      won: opportunities.filter((item) => item.status === "GANHO").length,
      lost: opportunities.filter((item) => item.status === "PERDIDO").length,
    };
  }, [loadedAt, opportunities]);

  const issues = useMemo(() => {
    const next: Issue[] = [];
    if (technical && !technical.workerHealth.healthy) next.push({ title: "Worker sem sinal recente", impact: "Comentários podem não avançar para o envio de DM.", cause: "Processo parado, Redis indisponível ou heartbeat expirado.", action: "Verificar o serviço do worker", href: "/diagnostics#saude-tecnica", severity: "error" });
    if (technical?.dmFailures.length) next.push({ title: `${technical.dmFailures.length} envio(s) com falha ou bloqueio`, impact: "A experiência configurada pode não ter chegado ao contato.", cause: "Limite, regra de envio, falha da Meta ou configuração incompleta.", action: "Revisar falhas recentes", href: "/diagnostics#falhas-tecnicas", severity: "error" });
    if (technical?.webhookFailures.length) next.push({ title: `${technical.webhookFailures.length} webhook(s) com falha`, impact: "Novos eventos podem ter exigido reconciliação.", cause: "Payload inválido, permissão ou erro temporário de processamento.", action: "Revisar eventos do webhook", href: "/diagnostics#falhas-tecnicas", severity: "warning" });
    if (commercial.unassigned) next.push({ title: `${commercial.unassigned} oportunidade(s) sem responsável`, impact: "Contatos podem ficar sem continuidade.", cause: "Atribuição ainda não realizada.", action: "Distribuir no pipeline", href: "/opportunities", severity: "warning" });
    if (commercial.overdue) next.push({ title: `${commercial.overdue} follow-up(s) vencido(s)`, impact: "O próximo contato planejado já passou do prazo.", cause: "Próxima ação não concluída ou não reagendada.", action: "Revisar prazos", href: "/opportunities", severity: "error" });
    if (commercial.stalled) next.push({ title: `${commercial.stalled} negociação(ões) parada(s)`, impact: "Oportunidades abertas estão sem avanço há mais de três dias.", cause: "Falta de resposta, objeção ou próxima ação indefinida.", action: "Abrir negociações", href: "/opportunities?status=NEGOCIANDO", severity: "warning" });
    return next;
  }, [commercial, technical]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Saúde operacional</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Diagnóstico</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Saúde técnica e saúde comercial são verificadas separadamente.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-border bg-surface px-4 text-sm font-semibold hover:border-border-hover disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden="true" />{loading ? "Atualizando..." : "Atualizar"}</button>
      </header>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-error">{error}</div>}

      {loading && !loadedAt ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="panel h-32 rounded" />)}</div> : (
        <>
          <section aria-labelledby="saude-comercial" className="space-y-4">
            <div><h2 id="saude-comercial" className="text-lg font-semibold">Saúde comercial</h2><p className="mt-1 text-xs text-muted">Ações pendentes nas oportunidades persistidas.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Sem responsável" value={commercial.unassigned} helper="Oportunidades abertas sem pessoa atribuída." alert={commercial.unassigned > 0} />
              <Metric label="Sem primeira abordagem" value={commercial.unanswered} helper="Oportunidades ainda na etapa Novo." alert={commercial.unanswered > 0} />
              <Metric label="Follow-ups vencidos" value={commercial.overdue} helper="Prazo da próxima ação já expirou." alert={commercial.overdue > 0} />
              <Metric label="Negociações paradas" value={commercial.stalled} helper="Sem atualização há mais de três dias." alert={commercial.stalled > 0} />
              <Metric label="Ganhas" value={commercial.won} helper="Etapa ganha; receita depende de venda confirmada." />
              <Metric label="Perdidas" value={commercial.lost} helper="Oportunidades encerradas com motivo obrigatório." />
            </div>
          </section>

          <section id="saude-tecnica" aria-labelledby="titulo-saude-tecnica" className="space-y-4 scroll-mt-24">
            <div><h2 id="titulo-saude-tecnica" className="text-lg font-semibold">Saúde técnica</h2><p className="mt-1 text-xs text-muted">Conexão, worker, fila e processamento. Acesso restrito a administradores.</p></div>
            {technicalForbidden ? (
              <div className="rounded border border-zinc-200 bg-zinc-50 p-5"><p className="text-sm font-semibold">Dados técnicos restritos</p><p className="mt-1 text-sm text-muted">Seu papel permite trabalhar oportunidades, mas não visualizar logs operacionais do workspace.</p></div>
            ) : technical ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Worker" value={technical.workerHealth.healthy ? "Saudável" : "Atenção"} helper={technical.workerHealth.ageMs == null ? "Nenhum heartbeat disponível." : `Último heartbeat há ${Math.round(technical.workerHealth.ageMs / 1000)}s.`} alert={!technical.workerHealth.healthy} />
                <Metric label="Fila aguardando" value={technical.queueCounts?.waiting ?? "—"} helper={technical.queueCounts ? "Jobs deste workspace aguardando processamento." : "Indisponível por workspace; zero não foi presumido."} />
                <Metric label="Fila ativa" value={technical.queueCounts?.active ?? "—"} helper={technical.queueCounts ? "Jobs deste workspace em processamento agora." : "Indisponível por workspace; zero não foi presumido."} />
                <Metric label="Fila atrasada" value={technical.queueCounts?.delayed ?? "—"} helper={technical.queueCounts ? "Jobs deste workspace agendados para nova tentativa." : "Indisponível por workspace; zero não foi presumido."} alert={(technical.queueCounts?.delayed ?? 0) > 0} />
                <Metric label="Fila com falha" value={technical.queueCounts?.failed ?? "—"} helper={technical.queueCounts ? "Jobs deste workspace que esgotaram ou falharam." : "Indisponível por workspace; zero não foi presumido."} alert={(technical.queueCounts?.failed ?? 0) > 0} />
                <Metric label="Falhas de token" value={technical.tokenRefreshFailures.length} helper="Renovações recentes que exigem atenção." alert={technical.tokenRefreshFailures.length > 0} />
              </div>
            ) : null}
          </section>

          <section className="panel rounded p-4 sm:p-6">
            <div className="flex items-center gap-2">{issues.length ? <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />}<h2 className="text-lg font-semibold">Problemas acionáveis</h2></div>
            {issues.length === 0 ? <p className="mt-4 text-sm text-muted">Nenhum problema identificado nos dados disponíveis agora.</p> : (
              <div className="mt-5 divide-y divide-border">{issues.map((issue) => (
                <article key={issue.title} className="grid gap-3 py-4 lg:grid-cols-[minmax(180px,0.7fr)_1fr_1fr_auto] lg:items-start">
                  <p className={`text-sm font-semibold ${issue.severity === "error" ? "text-error" : "text-warning"}`}>{issue.title}</p>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Impacto</p><p className="mt-1 text-sm">{issue.impact}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Causa provável</p><p className="mt-1 text-sm">{issue.cause}</p></div>
                  <Link href={issue.href} className="inline-flex min-h-10 items-center rounded border border-border px-3 text-sm font-semibold text-accent hover:border-border-hover">{issue.action}</Link>
                </article>
              ))}</div>
            )}
          </section>

          {technical && (
            <section id="falhas-tecnicas" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
              <div className="panel rounded p-4 sm:p-6"><div className="flex items-center gap-2"><ServerCog className="h-5 w-5 text-accent" aria-hidden="true" /><h2 className="font-semibold">Falhas de envio</h2></div><div className="mt-4 divide-y divide-border">{technical.dmFailures.length === 0 && <p className="py-5 text-sm text-muted">Nenhuma falha recente.</p>}{technical.dmFailures.map((item) => <article key={item.id} className="py-3"><p className="text-sm font-semibold">{item.automation.name}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{item.errorMessage ?? item.commentText}</p><p className="mt-1 text-xs text-muted">{new Date(item.updatedAt).toLocaleString("pt-BR")}</p></article>)}</div></div>
              <div className="panel rounded p-4 sm:p-6"><h2 className="font-semibold">Falhas de webhook</h2><div className="mt-4 divide-y divide-border">{technical.webhookFailures.length === 0 && <p className="py-5 text-sm text-muted">Nenhuma falha recente.</p>}{technical.webhookFailures.map((item) => <article key={item.id} className="py-3"><p className="text-sm font-semibold">{item.object ?? "Evento do Instagram"}</p><p className="mt-1 text-xs text-muted">{item.errorMessage ?? "Erro sem detalhe seguro disponível"}</p><p className="mt-1 text-xs text-muted">{new Date(item.createdAt).toLocaleString("pt-BR")}</p></article>)}</div></div>
            </section>
          )}
        </>
      )}

      <aside className="rounded border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">Contagens comerciais usam até as 100 oportunidades mais recentes retornadas pela API; se houver paginação, este diagnóstico é parcial. Logs técnicos nunca incluem tokens ou segredos.</aside>
    </div>
  );
}
