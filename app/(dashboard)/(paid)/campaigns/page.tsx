"use client";

/**
 * Campaigns List Page
 *
 * Shows all campaigns as cards with toggle and delete.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { readCache, writeCache } from "@/lib/client-cache";

interface Campaign {
  id: string;
  name: string;
  goal: string | null;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  isActive: boolean;
  wholeWordMatch: boolean;
  instagramAccountId: string;
  instagramAccount: {
    username: string;
    instagramId: string;
  };
  reportShareSlug: string | null;
  reportShareEnabled: boolean;
  reportUrl: string | null;
  createdAt: string;
  _count: { dmLogs: number };
  trackedLinks: Array<{
    id: string;
    slug: string;
    label: string | null;
    destinationUrl: string;
    trackedUrl: string;
    _count: { clicks: number };
  }>;
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number | null;
    topKeywords: { keyword: string; count: number }[];
  };
}

export default function CampaignsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [loading, setLoading] = useState(true);
  // postId -> current thumbnail URL, fetched live (Instagram URLs expire, so
  // they are never stored on the campaign).
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  // postId -> video URL for reels, so a campaign thumbnail can play on click.
  const [videos, setVideos] = useState<Record<string, string>>({});
  // The reel currently playing in the lightbox (null when closed).
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    postUrl: string | null;
    poster: string | null;
  } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">(
    "all"
  );

  const fetchAutomations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }
      const res = await fetch(
        `/api/automations${params.size ? `?${params}` : ""}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.success) setAutomations(data.data);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setAccounts(payload.data.instagramAccounts ?? []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAutomations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAutomations]);

  // Fetch fresh post thumbnails (and reel video URLs) for the accounts in view
  // and map them by postId. Cache-first so they show instantly on a return
  // visit. Instagram URLs expire, so they are never stored on the campaign.
  useEffect(() => {
    if (automations.length === 0) return;
    let cancelled = false;
    const accountIds = Array.from(
      new Set(automations.map((a) => a.instagramAccountId))
    ).sort();
    const cacheKey = `ig-media:${accountIds.join(",")}`;

    const cached = readCache<{
      thumbs: Record<string, string>;
      videos: Record<string, string>;
    }>(cacheKey, 15 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (cached.data) {
      setThumbnails(cached.data.thumbs);
      setVideos(cached.data.videos);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    Promise.all(
      accountIds.map((accountId) =>
        fetch(`/api/instagram/posts?instagramAccountId=${accountId}&limit=50`)
          .then((res) => res.json())
          .then((payload) =>
            payload.success
              ? (payload.data as {
                  id: string;
                  media_type?: string;
                  media_url?: string;
                  thumbnail_url?: string;
                }[])
              : []
          )
          .catch(() => [])
      )
    ).then((lists) => {
      if (cancelled) return;
      const thumbs: Record<string, string> = {};
      const vids: Record<string, string> = {};
      for (const list of lists) {
        for (const media of list) {
          const url = media.thumbnail_url ?? media.media_url;
          if (url) thumbs[media.id] = url;
          if (media.media_type === "VIDEO" && media.media_url) {
            vids[media.id] = media.media_url;
          }
        }
      }
      setThumbnails(thumbs);
      setVideos(vids);
      writeCache(cacheKey, { thumbs, videos: vids });
    });

    return () => {
      cancelled = true;
    };
  }, [automations]);

  // Close the reel lightbox on Escape.
  useEffect(() => {
    if (!playingVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayingVideo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playingVideo]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  async function toggleAtiva(id: string, isActive: boolean) {
    const next = !isActive;
    if (
      next &&
      !window.confirm(
        "Ativar esta campanha? Novos comentários que atendam às regras poderão receber respostas automáticas."
      )
    ) {
      return;
    }
    const setActive = (value: boolean) =>
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: value } : a))
      );
    // Flip immediately, then revert if the server does not confirm the new
    // state — a 200 alone is not proof the field was written.
    setStatusUpdatingId(id);
    setActive(next);
    try {
      const res = await fetch(`/api/automations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: next,
          ...(next ? { activationConfirmed: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || data.data?.isActive !== next) {
        throw new Error(data.error ?? "O servidor não confirmou o novo status");
      }
    } catch (err) {
      console.error("Failed to toggle:", err);
      setActive(isActive);
      alert("Não foi possível alterar o status da campanha. Tente novamente.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function copyReelUrl(auto: Campaign) {
    setMenuOpenId(null);
    if (!auto.postUrl) return;
    try {
      await navigator.clipboard.writeText(auto.postUrl);
      setCopiedId(auto.id);
      window.setTimeout(
        () => setCopiedId((cur) => (cur === auto.id ? null : cur)),
        1500
      );
    } catch (err) {
      console.error("Failed to copy reel URL:", err);
    }
  }

  async function deleteAutomation(id: string) {
    if (!confirm("Excluir esta automação sem histórico? Esta ação não pode ser desfeita.")) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Não foi possível excluir a automação.");
      }
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
      setActionError(
        err instanceof Error ? err.message : "Não foi possível excluir a automação."
      );
    }
  }

  async function duplicateAutomation(auto: Campaign) {
    setMenuOpenId(null);
    const specific = !auto.matchAnyPost && !auto.pendingNextReel;
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${auto.name} — cópia`,
          instagramAccountId: auto.instagramAccountId,
          postId: specific ? auto.postId : null,
          postUrl: specific ? auto.postUrl : null,
          matchAnyPost: auto.matchAnyPost,
          pendingNextReel: auto.pendingNextReel,
          matchAnyWord: auto.matchAnyWord,
          keywords: auto.keywords,
          dmMessage: auto.dmMessage,
          openingDmEnabled: auto.openingDmEnabled,
          openingDmMessage: auto.openingDmMessage,
          openingDmButtonLabel: auto.openingDmButtonLabel,
          publicReplyEnabled: auto.publicReplyEnabled,
          publicReplyMessages: auto.publicReplyMessages,
          trackedDestinationUrl: auto.trackedLinks[0]?.destinationUrl ?? "",
          secondaryDestinationUrl: auto.trackedLinks[1]?.destinationUrl ?? "",
          secondaryButtonLabel: auto.trackedLinks[1]?.label ?? "Abrir link",
          requireFollow: auto.requireFollow,
          followPromptMessage: auto.followPromptMessage,
          followPromptButtonLabel: auto.followPromptButtonLabel,
          wholeWordMatch: auto.wholeWordMatch,
          isActive: false,
        }),
      });
      const data = await res.json();
      if (data.success) void fetchAutomations();
      else console.error("Duplicate failed:", data.error);
    } catch (err) {
      console.error("Failed to duplicate:", err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="panel rounded p-6 h-36" />
        ))}
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const filtered = automations
    .filter((a) => {
      if (statusFilter === "active" && !a.isActive) return false;
      if (statusFilter === "paused" && a.isActive) return false;
      if (!query) return true;
      return (
        a.name.toLowerCase().includes(query) ||
        a.keywords.some((k) => k.toLowerCase().includes(query)) ||
        a.dmMessage.toLowerCase().includes(query)
      );
    })
    // The API orders by createdAt desc, but the cards show clicks-per-send, so
    // rank measured ratios first, then volume. No-send rows stay at the end.
    .sort(
      (a, b) =>
        (b.analytics.ctr ?? Number.NEGATIVE_INFINITY) -
          (a.analytics.ctr ?? Number.NEGATIVE_INFINITY) ||
        b.analytics.sent - a.analytics.sent
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {filtered.length}
            {filtered.length !== automations.length
              ? ` de ${automations.length}`
              : ""}{" "}
            {automations.length === 1 ? "automação" : "automações"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {accounts.length > 1 && (
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={handleAccountChange}
            />
          )}
          <Link
            href="/campaigns/import"
            className="flex-1 rounded border border-border px-4 py-2 text-center text-sm font-medium text-muted hover:text-foreground sm:flex-none"
          >
            Importar
          </Link>
          <Link
            href="/campaigns/new"
            className="flex-1 rounded bg-accent px-4 py-2 text-center text-sm font-medium text-white hover:bg-accent-hover sm:flex-none"
          >
            Nova automação
          </Link>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-error">
          {actionError}
        </div>
      )}

      {/* Search + status filter */}
      {automations.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, palavra-chave ou mensagem…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
          />
          <div className="inline-flex shrink-0 rounded-lg bg-surface p-1">
            {(["all", "active", "paused"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-background font-medium text-foreground ring-1 ring-accent/40"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {{ all: "Todas", active: "Ativas", paused: "Pausadas" }[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {automations.length === 0 && (
        <div className="panel rounded p-8 text-center sm:p-12">
          <h3 className="text-lg font-semibold mb-2">Nenhuma automação criada</h3>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
            Crie sua primeira automação de comentário para DM e transforme uma publicação ou reel em um fluxo mensurável de conversas.
          </p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-accent text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            Criar automação
          </Link>
        </div>
      )}

      {/* No matches for the current filter */}
      {automations.length > 0 && filtered.length === 0 && (
        <div className="panel rounded p-8 text-center text-sm text-muted">
          Nenhuma automação corresponde à sua busca.
        </div>
      )}

      {/* Campaign cards */}
      <div className="space-y-3">
        {filtered.map((auto) => {
          const videoUrl = auto.postId ? videos[auto.postId] : undefined;
          const thumb = auto.postId ? thumbnails[auto.postId] : undefined;
          return (
          <div
            key={auto.id}
            onClick={() => router.push(`/campaigns/${auto.id}`)}
            className="panel rounded p-4 hover:border-border-hover transition-all cursor-pointer"
          >
            {/* Wraps rather than compressing: on a phone the action buttons drop
                to their own line instead of squeezing the campaign summary. */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              {auto.postId && thumb && (
                videoUrl ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayingVideo({
                        url: videoUrl,
                        postUrl: auto.postUrl,
                        poster: thumb,
                      });
                    }}
                    aria-label="Reproduzir prévia do reel"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt="Reel da automação"
                      className="w-12 h-12 rounded object-cover border border-border hover:border-border-hover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </button>
                ) : (
                  <a
                    href={auto.postUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt="Publicação da automação"
                      className="w-12 h-12 rounded object-cover border border-border"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </a>
                )
              )}
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold truncate">{auto.name}</h3>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    @{auto.instagramAccount.username}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      auto.isActive
                        ? "bg-success/10 text-success"
                        : "bg-zinc-500/10 text-muted"
                    }`}
                  >
                    {auto.isActive ? "Ativa" : "Pausada"}
                  </span>
                  {auto.pendingNextReel && (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-warning">
                      Aguardando o próximo reel
                    </span>
                  )}
                  {auto.requireFollow && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      Requer seguir o perfil
                    </span>
                  )}
                  {auto.trackedLinks.length >= 2 && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      2 links
                    </span>
                  )}
                </div>

                {/* Keywords */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {auto.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium border border-accent/10"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                {/* DM preview */}
                <p className="text-sm text-muted truncate">&ldquo;{auto.dmMessage}&rdquo;</p>

                {/* Tracked link sent */}
                {auto.trackedLinks[0]?.trackedUrl && (
                  <p className="mt-2 truncate font-mono text-xs text-zinc-500">
                    {auto.trackedLinks[0].trackedUrl}
                  </p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-zinc-500">
                  <span className="font-medium text-foreground">
                    {auto._count.dmLogs} execuções
                  </span>
                  <span>·</span>
                  <span className="font-medium text-foreground">
                    {auto.analytics.ctr == null ? "—" : `${auto.analytics.ctr}%`} de cliques/DM
                  </span>
                  <span>·</span>
                  <span>{auto.analytics.sent} enviadas</span>
                  <span>·</span>
                  <span>{auto.analytics.skipped} ignoradas</span>
                  <span>·</span>
                  <span>{auto.analytics.failed} falharam</span>
                  <span>·</span>
                  <span>{auto.analytics.clicks} cliques</span>
                </div>
                <p className="mt-2 text-xs leading-4 text-zinc-500">
                  Cliques/DM usa eventos de acesso ÷ DMs enviadas; pode incluir acessos repetidos ou prévias automatizadas e não representa venda.
                </p>

                {auto.analytics.topKeywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {auto.analytics.topKeywords.map((keyword) => (
                      <span
                        key={keyword.keyword}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted"
                      >
                        {keyword.keyword}: {keyword.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                className="ml-auto flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Copy reel URL */}
                {auto.postUrl && (
                  <button
                    onClick={() => void copyReelUrl(auto)}
                    className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-border-hover hover:text-foreground"
                  >
                    {copiedId === auto.id ? "Copiado!" : "Copiar URL"}
                  </button>
                )}
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => void toggleAtiva(auto.id, auto.isActive)}
                  disabled={statusUpdatingId === auto.id}
                  role="switch"
                  aria-checked={auto.isActive}
                  aria-label={`${auto.isActive ? "Pausar" : "Ativar"} campanha ${auto.name}`}
                  className={`
                    relative h-6 w-11 rounded-full transition-colors disabled:cursor-wait disabled:opacity-50
                    ${auto.isActive ? "bg-accent" : "bg-zinc-300"}
                  `}
                >
                  <span
                    className={`
                      absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm
                      ${auto.isActive ? "left-6" : "left-1"}
                    `}
                  />
                </button>

                {/* Kebab menu */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setMenuOpenId((cur) => (cur === auto.id ? null : auto.id))
                    }
                    aria-label="Mais ações"
                    className="px-2 py-1 rounded text-lg leading-none text-muted hover:text-foreground"
                  >
                    ⋯
                  </button>
                  {menuOpenId === auto.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                        <button
                          onClick={() => void duplicateAutomation(auto)}
                          className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            void deleteAutomation(auto.id);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-error hover:bg-surface-hover"
                        >
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Reel lightbox */}
      {playingVideo && (
        <dialog
          open
          className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/80 p-4"
          aria-modal="true"
          aria-label="Prévia do reel"
        >
          <div className="relative flex max-w-full flex-col items-end gap-2">
            <div className="flex items-center gap-4 text-sm">
              {playingVideo.postUrl && (
                <a
                  href={playingVideo.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-300 hover:text-white"
                >
                  Abrir no Instagram
                </a>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => setPlayingVideo(null)}
                className="text-zinc-300 hover:text-white"
              >
                Fechar
              </button>
            </div>
            <video
              src={playingVideo.url}
              poster={playingVideo.poster ?? undefined}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[80vh] max-w-full rounded-lg"
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
