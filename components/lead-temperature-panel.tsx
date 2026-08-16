"use client";

/**
 * Quem está esperando resposta, agrupado por temperatura, com o estado comercial
 * de cada um.
 *
 * A fila vem de `/api/leads/queue` — as mesmas conversas de DM que a caixa ao
 * lado mostra, filtradas por "a última mensagem é da pessoa" e ordenadas pelo
 * que resta da janela de 24h da Meta. Ler a mesma fonte da caixa é o ponto: este
 * painel não pode dizer "nenhum sinal" logo acima de uma lista de gente que
 * acabou de escrever.
 *
 * A temperatura é observada; o estado ao lado é declarado por alguém aqui.
 * Manter os dois lado a lado é o que mostra um lead quente parado sem abordagem.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock3, RefreshCw } from "lucide-react";
import TemperatureBadge from "@/components/temperature-badge";
import { TEMPERATURE_LABEL, TEMPERATURE_ORDER, type LeadTemperature } from "@/lib/heatmap/priority";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/lead-status";

interface QueueLead {
  position: number;
  key: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName: string | null;
  lastInboundMessage: string;
  lastInboundAt: string | null;
  hoursLeftInWindow: number | null;
  windowOpen: boolean;
  matchedKeyword: string | null;
  score: number;
  temperature: LeadTemperature;
  leadStatus: LeadStatusValue;
}

interface QueueData {
  account: { id: string; username: string };
  conversationsScanned: number;
  queue: QueueLead[];
}

/** 409 do guard de identidade pede reconexão, não "lista vazia". */
interface QueueError { message: string; reconnect: boolean }

// Quantas pessoas a lista mostra de uma vez. O chip de cada temperatura diz o
// total; isto é só o quanto cabe na tela sem virar uma segunda fila.
const VISIBLE = 12;

// ponytail: espelha o formatDuration privado de lib/leads/dm-queue.ts. Se um dia
// ele for exportado, apagar este.
function formatHours(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Sem horário devolvido pela Meta o rótulo é "—" — nunca "0h". */
function windowLabel(lead: QueueLead): { text: string; urgent: boolean } {
  if (lead.hoursLeftInWindow === null) return { text: "—", urgent: false };
  if (!lead.windowOpen) return { text: `janela fechada há ${formatHours(-lead.hoursLeftInWindow)}`, urgent: false };
  return { text: `fecha em ${formatHours(lead.hoursLeftInWindow)}`, urgent: lead.hoursLeftInWindow <= 6 };
}

function displayName(lead: QueueLead) { return lead.commenterName ?? lead.commenterId.slice(0, 10); }

export default function LeadTemperaturePanel({ accountId }: { accountId: string }) {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<QueueError | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadTemperature | null>(null);

  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    // Sem setState aqui: trocar de conta remonta o painel (key no pai), então o
    // estado inicial já é "carregando". Só o retry precisa reagendá-lo, e isso
    // acontece no handler.
    fetch(`/api/leads/queue?instagramAccountId=${encodeURIComponent(accountId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw { message: payload.error ?? "Falha ao montar a fila de leads", reconnect: payload.code === "account_identity_unverified" };
        }
        return payload.data as QueueData;
      })
      .then((payload) => { setData(payload); setError(null); })
      .catch((reason) => {
        if (reason?.name === "AbortError") return;
        setData(null);
        setError({ message: reason?.message ?? "Falha ao montar a fila de leads", reconnect: Boolean(reason?.reconnect) });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [accountId, retry]);

  function tryAgain() { setLoading(true); setError(null); setRetry((value) => value + 1); }

  async function updateStatus(lead: QueueLead, status: LeadStatusValue) {
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
      setError({ message: "Não foi possível salvar o estado comercial.", reconnect: false });
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
        Quem está esperando resposta
        <span className="ml-2 font-normal text-muted">DMs sem resposta agora</span>
      </summary>

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs leading-5 text-muted">
          Conversas em que a última mensagem é da pessoa. A ordem segue o prazo da janela de 24h da Meta; a temperatura resume a urgência somada aos reforços observados, não previsão de compra.
        </p>

        {loading && <div className="mt-3 h-24 animate-pulse rounded bg-surface-hover" aria-label="Carregando a fila de leads" />}

        {!loading && error && (
          <div className="mt-3 rounded border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-error">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error.reconnect ? "Reconecte a conta do Instagram" : "Não foi possível carregar ou salvar."}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">{error.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {error.reconnect && <Link href="/settings" className="inline-flex items-center rounded border border-border px-2 py-1 text-xs font-medium text-foreground">Ir para as configurações</Link>}
              <button onClick={tryAgain} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground">
                <RefreshCw className="h-3 w-3" aria-hidden="true" />Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-5" role="group" aria-label="Filtrar por temperatura">
              {TEMPERATURE_ORDER.map((temperature) => {
                const count = leads.filter((lead) => lead.temperature === temperature).length;
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
                {filter
                  ? `Ninguém em “${TEMPERATURE_LABEL[filter]}” na fila de agora.`
                  : `Nenhuma DM esperando resposta — nas ${data.conversationsScanned} conversas lidas, nenhuma parou numa mensagem da outra pessoa.`}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {shown.map((lead) => {
                  const deadline = windowLabel(lead);
                  return (
                    <li key={lead.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                      <span className="text-xs font-semibold tabular-nums text-muted" aria-label={`Posição ${lead.position}`}>{lead.position}.</span>
                      <TemperatureBadge temperature={lead.temperature} score={lead.score} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          @{displayName(lead)}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {lead.lastInboundMessage ? `“${lead.lastInboundMessage}”` : "Mensagem sem texto (mídia ou anexo)"}
                        </p>
                        <p className={`mt-0.5 flex items-center gap-1 text-xs ${deadline.urgent ? "font-semibold text-error" : "text-muted"}`}>
                          <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />{deadline.text}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <span className="sr-only">Estado comercial de @{displayName(lead)}</span>
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
                  );
                })}
              </ul>
            )}

            {matching.length > shown.length && (
              <p className="mt-2 text-xs text-muted">
                Mostrando {shown.length} de {matching.length}. Veja a fila completa no <a href="/heatmap" className="underline">Mapa de Calor</a>.
              </p>
            )}

            <p className="mt-3 text-xs leading-5 text-muted">
              Esta lista lê apenas mensagens diretas: comentários não entram aqui. Responder dentro da janela de 24h é uma regra da Meta, não uma previsão de compra. Vendas só contam após confirmação manual, por CRM ou checkout.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
