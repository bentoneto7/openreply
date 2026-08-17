"use client";

/**
 * Instagram Resultados Page
 *
 * Aggregate reach/engagement across your recent posts, plus a per-post table.
 * Visualizações / reach / saved / shares come from Instagram media insights (requires
 * the insights permission); likes and comments are always available.
 */

import { useEffect, useState } from "react";
import AccountSelect from "@/components/account-select";
import StatCard from "@/components/stat-card";
import FollowerChart from "@/components/follower-chart";
import type { OverviewResponse } from "@/app/api/instagram/overview/route";

function formatNumber(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
}

const COUNT_OPTIONS = [
  { value: "25", label: "Últimas 25" },
  { value: "50", label: "Últimas 50" },
  { value: "100", label: "Últimas 100" },
  { value: "all", label: "Todo o período" },
];

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [count, setCount] = useState("50");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") {
      params.set("instagramAccountId", selectedAccountId);
    }
    params.set("count", count);

    fetch(`/api/instagram/overview?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.error ?? "Não foi possível carregar os resultados");
        }
      })
      .catch(() => setError("Não foi possível carregar os resultados"))
      .finally(() => setLoading(false));
  }, [selectedAccountId, count]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  function handleCountChange(next: string) {
    setLoading(true);
    setCount(next);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="panel rounded p-4 h-24 sm:p-5">
            <div className="h-4 w-16 bg-zinc-200 rounded" />
            <div className="mt-3 h-6 w-20 bg-zinc-200/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel rounded p-8 text-center">
        <p className="text-sm text-error">{error}</p>
        {error.includes("connect") && (
          <a
            href="/api/instagram/connect"
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            Conectar Instagram
          </a>
        )}
      </div>
    );
  }

  if (!data) return null;

  const {
    totals,
    posts,
    accounts,
    insightsAvailable,
    followers,
    followerHistory,
    profile,
    engagementRate,
  } = data;
  const username = profile?.username ?? data.account.username;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {profile?.avatarUrl && (
            // Instagram CDN URLs are hotlink-sensitive and not in the Next image
            // allowlist; the same plain <img> + no-referrer pattern as the
            // campaign preview and the post picker.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">Resultados</h1>
            <p className="mt-1 truncate text-sm text-muted">
              {profile?.name ? `${profile.name} · ` : ""}@{username}
              {/* Point-in-time account total, deliberately outside the tile row
                  below, which sums only the selected posts. */}
              {followers !== null
                ? ` · ${followers.toLocaleString("pt-BR")} seguidores`
                : ""}
            </p>
            <p className="mt-1 text-sm text-muted">
              {data.requestedCount === "all" ? "Todo o período" : "Recentes"} —{" "}
              {totals.posts} publicaç{totals.posts === 1 ? "ão" : "ões"}
              {data.truncated ? ` (limitado a ${totals.posts})` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Período
            </span>
            <select
              value={count}
              onChange={(e) => handleCountChange(e.target.value)}
              className="border-0 bg-transparent py-2 pr-1 text-sm text-foreground outline-none"
            >
              {COUNT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {accounts.length > 1 && (
            <AccountSelect
              accounts={accounts.map((a) => ({
                id: a.id,
                username: a.username,
                instagramId: a.id,
              }))}
              value={selectedAccountId}
              onChange={handleAccountChange}
            />
          )}
        </div>
      </div>

      {!insightsAvailable && (
        <div className="panel rounded p-4 border border-border">
          <p className="text-sm text-foreground">
            Visualizações, Alcance, Salvos e Compartilhamentos dependem da
            permissão de insights do Instagram, que ainda depende de aprovação
            da Meta.
          </p>
          <p className="text-sm text-muted mt-1">
            Enquanto isso essas métricas aparecem como “—”: não são zero, são
            desconhecidas. Curtidas e Comentários continuam disponíveis.
          </p>
        </div>
      )}

      {/* Aggregate totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Visualizações" value={formatNumber(totals.views)} />
        <StatCard label="Alcance" value={formatNumber(totals.reach)} />
        <StatCard label="Curtidas" value={formatNumber(totals.likes)} />
        <StatCard label="Comentários" value={formatNumber(totals.comments)} />
        <StatCard label="Salvos" value={formatNumber(totals.saved)} />
        <StatCard label="Compartilhamentos" value={formatNumber(totals.shares)} />
        <StatCard label="Interações" value={formatNumber(totals.interactions)} />
        {/* Interações ÷ alcance. Só aparece com os dois lados medidos — ver
            engagementRate na rota. */}
        <StatCard
          label="Taxa de engajamento"
          value={engagementRate === null ? "—" : `${engagementRate}%`}
        />
      </div>

      {/* Follower trend — account-level, independent of the post range */}
      <FollowerChart data={followerHistory} followers={followers} />

      {/* Per-post table */}
      <div className="panel rounded p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Publicações{" "}
          <span className="font-normal text-muted">
            — ordenadas por comentários
          </span>
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">Nenhuma publicação encontrada</p>
        ) : (
          // The metric columns can't compress into a phone; let the table keep
          // its natural width and scroll inside the panel instead.
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-border">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Publicação</th>
                  <th className="py-2 px-3 font-medium text-right">Visualizações</th>
                  <th className="py-2 px-3 font-medium text-right">Alcance</th>
                  <th className="py-2 px-3 font-medium text-right">Curtidas</th>
                  <th className="py-2 px-3 font-medium text-right">Comentários</th>
                  <th className="py-2 px-3 font-medium text-right">Salvos</th>
                  <th className="py-2 px-3 font-medium text-right">Compartilhamentos</th>
                  <th className="py-2 pl-3 font-medium text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 pr-3 text-zinc-500">{i + 1}</td>
                    <td className="py-3 pr-4 max-w-xs">
                      <div className="flex items-center gap-3">
                        {p.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.thumbnailUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded bg-surface-hover" />
                        )}
                        <div className="min-w-0">
                          {p.permalink ? (
                            <a
                              href={p.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground hover:text-accent truncate block"
                            >
                              {p.caption || `Publicação ${p.mediaType}`}
                            </a>
                          ) : (
                            <span className="text-foreground truncate block">
                              {p.caption || `Publicação ${p.mediaType}`}
                            </span>
                          )}
                          <span className="text-xs text-zinc-500">{p.mediaType}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.views)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.reach)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.likes)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.comments)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.saved)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.shares)}
                    </td>
                    <td className="py-3 pl-3 text-right text-zinc-500">
                      {formatDate(p.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
