"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, FileChartColumn } from "lucide-react";

interface CampaignReportItem {
  id: string;
  name: string;
  isActive: boolean;
  reportShareEnabled: boolean;
  reportUrl: string | null;
  instagramAccount: { username: string };
  analytics: { sent: number; skipped: number; failed: number; clicks: number; ctr: number | null };
}

export default function ReportsPage() {
  const [items, setItems] = useState<CampaignReportItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/automations", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/workspace/members", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([campaignsPayload, membersPayload]) => {
        if (!campaignsPayload.success) throw new Error(campaignsPayload.error ?? "Não foi possível carregar os relatórios");
        setItems(campaignsPayload.data);
        if (membersPayload.success) setCanManage(membersPayload.data.currentUserRole !== "MEMBER");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os relatórios"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleSharing(item: CampaignReportItem) {
    const enabling = !item.reportShareEnabled;
    if (enabling && !window.confirm("Ativar um link público somente leitura para este relatório? Qualquer pessoa com o link poderá visualizá-lo.")) return;
    setBusy(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/automations?id=${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportShareEnabled: enabling }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Não foi possível alterar o compartilhamento");
      setItems((current) => current.map((campaign) => campaign.id === item.id ? { ...campaign, reportShareEnabled: enabling } : campaign));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Não foi possível alterar o compartilhamento");
    } finally {
      setBusy(null);
    }
  }

  async function copyUrl(item: CampaignReportItem) {
    if (!item.reportUrl) return;
    try {
      await navigator.clipboard.writeText(item.reportUrl);
      setCopied(item.id);
      window.setTimeout(() => setCopied((current) => current === item.id ? null : current), 1600);
    } catch {
      setError("O navegador não permitiu copiar o link.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Compartilhamento seguro</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Escolha quais campanhas terão um link público somente leitura. Os indicadores são acumulados desde a criação da campanha e mostram envios e cliques, não vendas.</p>
      </header>

      <aside className="rounded border border-accent-subtle-border bg-accent-subtle p-4 text-sm text-accent-strong">
        Links ficam inativos por padrão. Ativar o compartilhamento não expõe mensagens privadas, tokens ou dados internos do contato.
      </aside>

      {error && <div role="alert" className="rounded border border-error-subtle-border bg-error-subtle p-4 text-sm text-error">{error}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-52 rounded" />)}</div>
      ) : items.length === 0 ? (
        <section className="panel rounded p-10 text-center">
          <FileChartColumn className="mx-auto h-9 w-9 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Nenhuma campanha para relatar</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Crie uma campanha para acompanhar seus eventos operacionais e, se quiser, liberar um relatório compartilhável.</p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="panel rounded p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><h2 className="truncate font-semibold">{item.name}</h2><p className="mt-1 text-xs text-muted">@{item.instagramAccount.username} · {item.isActive ? "Campanha ativa" : "Campanha pausada"}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.reportShareEnabled ? "bg-success-subtle text-success-strong" : "bg-surface-muted text-muted"}`}>{item.reportShareEnabled ? "Compartilhado" : "Privado"}</span>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-center">
                <div><dt className="text-xs text-muted">DMs enviadas</dt><dd className="mt-1 font-semibold">{item.analytics.sent}</dd></div>
                <div><dt className="text-xs text-muted">Cliques</dt><dd className="mt-1 font-semibold">{item.analytics.clicks}</dd></div>
                <div><dt className="text-xs text-muted">Cliques/DM</dt><dd className="mt-1 font-semibold">{item.analytics.ctr == null ? "—" : `${item.analytics.ctr}%`}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-muted">A taxa usa eventos de acesso ÷ DMs enviadas; pode incluir repetições ou prévias automatizadas e não mede venda.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" disabled={!canManage || busy === item.id} onClick={() => void toggleSharing(item)} className="min-h-10 rounded border border-border px-3 text-sm font-semibold hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-50">
                  {busy === item.id ? "Salvando..." : item.reportShareEnabled ? "Desativar link" : "Ativar link público"}
                </button>
                {item.reportShareEnabled && item.reportUrl && (
                  <>
                    <button type="button" onClick={() => void copyUrl(item)} className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm font-semibold hover:border-border-hover"><Copy className="h-4 w-4" aria-hidden="true" />{copied === item.id ? "Copiado" : "Copiar"}</button>
                    <a href={item.reportUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover">Abrir <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
                  </>
                )}
              </div>
              {!canManage && <p className="mt-3 text-xs text-muted">Somente proprietários e administradores alteram o compartilhamento.</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
