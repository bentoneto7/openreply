"use client";

/**
 * Leads que mais interagiram, agrupados por temperatura, com o estado comercial
 * de cada um.
 *
 * A temperatura é derivada dos sinais que a plataforma observou (comentários,
 * DMs recebidas, cliques). O estado ao lado é o oposto: só muda quando alguém
 * aqui declara que fez alguma coisa. Manter os dois lado a lado é o ponto — um
 * lead quente há três dias sem abordagem é o que essa tela existe para mostrar.
 */

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import TemperatureBadge from "@/components/temperature-badge";
import { TEMPERATURE_LABEL, TEMPERATURE_ORDER, type LeadTemperature } from "@/lib/heatmap/priority";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/lead-status";

interface TopLead {
  key: string;
  instagramAccountId: string;
  instagramUsername: string;
  commenterId: string;
  commenterName: string | null;
  latestComment: string;
  latestKeyword: string | null;
  lastSeenAt: string;
  signalCount: number;
  score: number;
  temperature: LeadTemperature;
  leadStatus: LeadStatusValue;
  reasons: string[];
}

interface Overview {
  queue: TopLead[];
  temperatureCounts: Record<LeadTemperature, number>;
}

// Quantas pessoas a lista mostra de uma vez. O chip de cada temperatura diz o
// total; isto é só o quanto cabe na tela sem virar uma segunda fila.
const VISIBLE = 12;

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function LeadTemperaturePanel({ accountId }: { accountId: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadTemperature | null>(null);

  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    // Sem setState aqui: trocar de conta remonta o painel (key no pai), então o
    // estado inicial já é "carregando". Só o retry precisa reagendá-lo, e isso
    // acontece no handler.
    fetch(`/api/heatmap/overview?period=7d&instagramAccountId=${encodeURIComponent(accountId)}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Falha"); return response.json(); })
      .then((payload) => setData(payload.data))
      .catch((reason) => { if (reason.name !== "AbortError") setError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [accountId, retry]);

  function tryAgain() { setLoading(true); setError(false); setRetry((value) => value + 1); }

  async function updateStatus(lead: TopLead, status: LeadStatusValue) {
    setSaving(lead.key);
    // Otimista: o select já mostra o novo estado enquanto a escrita acontece.
    setData((current) => current && { ...current, queue: current.queue.map((item) => item.key === lead.key ? { ...item, leadStatus: status } : item) });
    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId: lead.instagramAccountId, commenterId: lead.commenterId, commenterName: lead.commenterName, status }),
      });
      if (!response.ok) throw new Error("Falha");
    } catch {
      // Reverter é mais honesto do que deixar a tela afirmar um estado que o
      // banco não tem.
      setData((current) => current && { ...current, queue: current.queue.map((item) => item.key === lead.key ? { ...item, leadStatus: lead.leadStatus } : item) });
      setError(true);
    } finally {
      setSaving(null);
    }
  }

  if (!accountId) return null;

  const leads = data?.queue ?? [];
  const matching = filter ? leads.filter((lead) => lead.temperature === filter) : leads;
  const shown = matching.slice(0, VISIBLE);

  return (
    <details open className="rounded border border-border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground marker:content-none">
        Quem mais interagiu no período
        <span className="ml-2 font-normal text-muted">últimos 7 dias</span>
      </summary>

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs leading-5 text-muted">
          Agrupado por temperatura — quanto mais quente, mais sinais recentes a Comentou observou. Temperatura é histórico de interação, não previsão de compra.
        </p>

        {loading && <div className="mt-3 h-24 animate-pulse rounded bg-surface-hover" aria-label="Carregando leads" />}

        {error && !loading && (
          <div className="mt-3 flex items-center gap-3 text-sm text-error">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Não foi possível carregar ou salvar.
            <button onClick={tryAgain} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground">
              <RefreshCw className="h-3 w-3" aria-hidden="true" />Tentar novamente
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-5" role="group" aria-label="Filtrar por temperatura">
              {TEMPERATURE_ORDER.map((temperature) => {
                const count = data.temperatureCounts[temperature] ?? 0;
                const active = filter === temperature;
                return (
                  <button
                    key={temperature}
                    onClick={() => setFilter(active ? null : temperature)}
                    aria-pressed={active}
                    className={`flex flex-col items-start gap-1.5 rounded border p-2 text-left transition-colors ${active ? "border-accent bg-surface-hover" : "border-border hover:bg-surface-hover"} ${count === 0 ? "opacity-60" : ""}`}
                  >
                    <TemperatureBadge temperature={temperature} />
                    <span className="text-xs text-muted">{count} pessoa{count === 1 ? "" : "s"}</span>
                  </button>
                );
              })}
            </div>

            {shown.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                {filter ? `Ninguém em “${TEMPERATURE_LABEL[filter]}” neste período.` : "Nenhum sinal registrado nos últimos 7 dias."}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {shown.map((lead) => (
                  <li key={lead.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    <TemperatureBadge temperature={lead.temperature} score={lead.score} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        @{lead.commenterName ?? lead.commenterId.slice(0, 10)}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {lead.latestComment ? `“${lead.latestComment}” · ` : ""}{lead.signalCount} comentário(s) · {dateFormat.format(new Date(lead.lastSeenAt))}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <span className="sr-only">Estado comercial de @{lead.commenterName ?? lead.commenterId.slice(0, 10)}</span>
                      <select
                        value={lead.leadStatus}
                        disabled={saving === lead.key}
                        onChange={(event) => updateStatus(lead, event.target.value as LeadStatusValue)}
                        className="min-h-9 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:opacity-50"
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status} value={status}>{LEAD_STATUS_LABEL[status]}</option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {matching.length > shown.length && (
              <p className="mt-2 text-xs text-muted">
                Mostrando {shown.length} de {matching.length}. Veja a fila completa no <a href="/heatmap" className="underline">Mapa de Calor</a>.
              </p>
            )}

            <p className="mt-3 text-xs leading-5 text-muted">
              A temperatura resume o que já aconteceu: comentários, mensagens recebidas e cliques registrados. Não indica intenção de compra nem garante resposta. Vendas só contam após confirmação manual, por CRM ou checkout.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
