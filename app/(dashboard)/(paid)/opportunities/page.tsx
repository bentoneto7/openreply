"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Columns3,
  List,
  Search,
  UserRound,
} from "lucide-react";
import {
  COMMERCIAL_STATUSES,
  COMMERCIAL_STATUS_LABEL,
  INTENT_CATEGORIES,
  INTENT_LABEL,
  type CommercialStatus,
  type IntentCategory,
  type Opportunity,
} from "@/lib/crm/client-types";

type ViewMode = "list" | "board";
type FilterAvailability = "loading" | "available" | "empty" | "unavailable";

interface InstagramAccountOption {
  id: string;
  username: string;
  name: string | null;
}

interface WorkspaceMemberOption {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

const WORKSPACE_ROLE_LABEL: Record<WorkspaceMemberOption["role"], string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
};

const STATUS_STYLE: Record<CommercialStatus, string> = {
  NOVO: "border-blue-200 bg-blue-50 text-blue-700",
  ABORDADO: "border-violet-200 bg-violet-50 text-violet-700",
  RESPONDEU: "border-cyan-200 bg-cyan-50 text-cyan-700",
  NEGOCIANDO: "border-amber-200 bg-amber-50 text-amber-700",
  GANHO: "border-green-200 bg-green-50 text-green-700",
  PERDIDO: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

function formatMoney(value: number | null) {
  if (value == null) return "Sem valor informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatRelativeDate(value: string | null, referenceTime: number | null) {
  if (!value) return "Sem prazo";
  const date = new Date(value);
  const overdue = referenceTime != null && date.getTime() < referenceTime;
  return {
    label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    overdue,
  };
}

function StatusPill({ status }: { status: CommercialStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {COMMERCIAL_STATUS_LABEL[status]}
    </span>
  );
}

function OpportunitySummary({ opportunity, referenceTime }: { opportunity: Opportunity; referenceTime: number | null }) {
  const nextDate = formatRelativeDate(opportunity.commercial.nextActionAt, referenceTime);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold text-foreground">
          @{opportunity.person.name ?? opportunity.person.id}
        </p>
        <span className="text-xs text-muted">@{opportunity.instagramAccount.username}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">
        {opportunity.origin.text ?? "Contato identificado sem texto de origem disponível."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{INTENT_LABEL[opportunity.intent.category ?? "UNKNOWN"]}</span>
        {opportunity.origin.keyword && <span>Palavra: {opportunity.origin.keyword}</span>}
        {opportunity.sourceAutomation && <span>{opportunity.sourceAutomation.name}</span>}
        {typeof nextDate === "object" && (
          <span className={nextDate.overdue ? "font-semibold text-error" : undefined}>
            Próxima ação: {nextDate.label}{nextDate.overdue ? " · vencida" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export default function OpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [view, setView] = useState<ViewMode>("list");
  const [status, setStatus] = useState<CommercialStatus | "all">("all");
  const [instagramAccountId, setInstagramAccountId] = useState("all");
  const [assigneeMemberId, setAssigneeMemberId] = useState("all");
  const [intentCategory, setIntentCategory] = useState<IntentCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccountOption[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [accountsAvailability, setAccountsAvailability] = useState<FilterAvailability>("loading");
  const [membersAvailability, setMembersAvailability] = useState<FilterAvailability>("loading");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState<"" | "ABORDADO" | "RESPONDEU" | "NEGOCIANDO">("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const initializeFilters = async () => {
        const requestedFilters = new URLSearchParams(window.location.search);
        const requestedStatus = requestedFilters.get("status");
        const requestedAccountId = requestedFilters.get("instagramAccountId");
        const requestedAssigneeId = requestedFilters.get("assigneeMemberId");
        const requestedIntent = requestedFilters.get("intentCategory");
        const requestedQuery = requestedFilters.get("q");

        if (requestedStatus && COMMERCIAL_STATUSES.includes(requestedStatus as CommercialStatus)) {
          setStatus(requestedStatus as CommercialStatus);
        }
        if (requestedIntent && INTENT_CATEGORIES.includes(requestedIntent as IntentCategory)) {
          setIntentCategory(requestedIntent as IntentCategory);
        }
        if (requestedQuery) setQuery(requestedQuery.slice(0, 120));

        const fetchPayload = async (url: string) => {
          const response = await fetch(url, { cache: "no-store" });
          const payload = await response.json();
          if (!response.ok || !payload.success) {
            throw new Error(payload.error ?? "Filtro indisponível");
          }
          return payload.data;
        };

        const [statsResult, membersResult] = await Promise.allSettled([
          fetchPayload("/api/dashboard/stats"),
          fetchPayload("/api/workspace/members"),
        ]);

        if (cancelled) return;

        if (statsResult.status === "fulfilled") {
          const options = (statsResult.value.instagramAccounts ?? []) as InstagramAccountOption[];
          setInstagramAccounts(options);
          setAccountsAvailability(options.length > 0 ? "available" : "empty");
          if (requestedAccountId && options.some((account) => account.id === requestedAccountId)) {
            setInstagramAccountId(requestedAccountId);
          }
        } else {
          setAccountsAvailability("unavailable");
        }

        if (membersResult.status === "fulfilled") {
          const options = (membersResult.value.members ?? []) as WorkspaceMemberOption[];
          setMembers(options);
          setMembersAvailability(options.length > 0 ? "available" : "empty");
          if (requestedAssigneeId && options.some((member) => member.id === requestedAssigneeId)) {
            setAssigneeMemberId(requestedAssigneeId);
          }
        } else {
          setMembersAvailability("unavailable");
        }

        setFiltersReady(true);
      };

      void initializeFilters();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const url = new URL(window.location.href);
    const syncFilter = (name: string, value: string) => {
      if (value === "all" || value === "") url.searchParams.delete(name);
      else url.searchParams.set(name, value);
    };

    syncFilter("status", status);
    syncFilter("instagramAccountId", instagramAccountId);
    syncFilter("assigneeMemberId", assigneeMemberId);
    syncFilter("intentCategory", intentCategory);
    syncFilter("q", query.trim());
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [assigneeMemberId, filtersReady, instagramAccountId, intentCategory, query, status]);

  const load = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "100" });
    if (status !== "all") params.set("status", status);
    if (instagramAccountId !== "all") params.set("instagramAccountId", instagramAccountId);
    if (assigneeMemberId !== "all") params.set("assigneeMemberId", assigneeMemberId);
    if (intentCategory !== "all") params.set("intentCategory", intentCategory);
    if (query.trim()) params.set("q", query.trim());
    if (cursor) params.set("cursor", cursor);

    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/opportunities?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Não foi possível carregar as oportunidades");
      }
      setItems((current) => cursor ? [...current, ...payload.data.items] : payload.data.items);
      setNextCursor(payload.data.page.nextCursor);
      setLoadedAt(Date.now());
      if (!cursor) setSelected(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as oportunidades");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [assigneeMemberId, instagramAccountId, intentCategory, query, status]);

  useEffect(() => {
    if (!filtersReady) return;
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
  }, [filtersReady, load]);

  const columns = useMemo(
    () => COMMERCIAL_STATUSES.map((columnStatus) => ({
      status: columnStatus,
      items: items.filter((item) => item.status === columnStatus),
    })),
    [items]
  );

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBatchStatus() {
    if (!batchStatus || selected.size === 0) return;
    const targets = items.filter((item) => selected.has(item.id));
    if (!window.confirm(`Mover ${targets.length} oportunidade(s) para ${COMMERCIAL_STATUS_LABEL[batchStatus]}?`)) return;

    setBatchBusy(true);
    setError(null);
    try {
      const responses = await Promise.all(targets.map(async (item) => {
        const response = await fetch(`/api/opportunities/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: item.version,
            idempotencyKey: `batch-${crypto.randomUUID()}`,
            status: batchStatus,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error ?? "Uma alteração não foi aplicada");
        return payload.data.opportunity as Opportunity;
      }));
      const byId = new Map(responses.map((item) => [item.id, item]));
      setItems((current) => current.map((item) => byId.get(item.id) ?? item));
      setSelected(new Set());
      setBatchStatus("");
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "Não foi possível atualizar a seleção");
      await load();
    } finally {
      setBatchBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Pipeline comercial</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Oportunidades</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Priorize cada contato, preserve a origem e registre o resultado confirmado.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-border bg-surface p-1" aria-label="Modo de visualização">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold ${view === "list" ? "bg-blue-50 text-accent" : "text-muted hover:text-foreground"}`}
          >
            <List className="h-4 w-4" aria-hidden="true" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            aria-pressed={view === "board"}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold ${view === "board" ? "bg-blue-50 text-accent" : "text-muted hover:text-foreground"}`}
          >
            <Columns3 className="h-4 w-4" aria-hidden="true" /> Kanban
          </button>
        </div>
      </header>

      <section className="panel rounded p-4" aria-label="Filtros de oportunidades">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="sm:col-span-2 xl:col-span-1">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Busca</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
              <input
                value={query}
                maxLength={120}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Contato, oferta ou palavra-chave"
                className="min-h-11 w-full rounded border border-border bg-surface py-2 pl-10 pr-3 text-sm text-foreground"
              />
            </span>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Etapa</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as CommercialStatus | "all")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-sm text-foreground"
            >
              <option value="all">Todas as etapas</option>
              {COMMERCIAL_STATUSES.map((item) => <option key={item} value={item}>{COMMERCIAL_STATUS_LABEL[item]}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Conta do Instagram</span>
            <select
              value={instagramAccountId}
              disabled={accountsAvailability !== "available"}
              onChange={(event) => setInstagramAccountId(event.target.value)}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accountsAvailability === "loading" && <option value="all">Carregando contas...</option>}
              {accountsAvailability === "unavailable" && <option value="all">Contas indisponíveis</option>}
              {accountsAvailability === "empty" && <option value="all">Nenhuma conta conectada</option>}
              {accountsAvailability === "available" && <option value="all">Todas as contas</option>}
              {instagramAccounts.map((account) => (
                <option key={account.id} value={account.id}>@{account.username}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Responsável</span>
            <select
              value={assigneeMemberId}
              disabled={membersAvailability !== "available"}
              onChange={(event) => setAssigneeMemberId(event.target.value)}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {membersAvailability === "loading" && <option value="all">Carregando equipe...</option>}
              {membersAvailability === "unavailable" && <option value="all">Equipe indisponível</option>}
              {membersAvailability === "empty" && <option value="all">Equipe sem integrantes</option>}
              {membersAvailability === "available" && <option value="all">Todos os responsáveis</option>}
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.user.name ?? member.user.email ?? "Integrante"} · {WORKSPACE_ROLE_LABEL[member.role]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Intenção</span>
            <select
              value={intentCategory}
              onChange={(event) => setIntentCategory(event.target.value as IntentCategory | "all")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-sm text-foreground"
            >
              <option value="all">Todas as intenções</option>
              {INTENT_CATEGORIES.map((item) => <option key={item} value={item}>{INTENT_LABEL[item]}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted" aria-live="polite">
            {accountsAvailability === "unavailable" && <p>O filtro por conta está indisponível; a fila geral continua acessível.</p>}
            {membersAvailability === "unavailable" && <p>O filtro por responsável está indisponível; a fila geral continua acessível.</p>}
          </div>
          {(status !== "all" || instagramAccountId !== "all" || assigneeMemberId !== "all" || intentCategory !== "all" || query) && (
            <button
              type="button"
              onClick={() => {
                setStatus("all");
                setInstagramAccountId("all");
                setAssigneeMemberId("all");
                setIntentCategory("all");
                setQuery("");
              }}
              className="min-h-9 rounded px-3 text-xs font-semibold text-accent hover:bg-blue-50"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      {selected.size > 0 && (
        <section className="flex flex-col gap-3 rounded border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center" aria-live="polite">
          <p className="text-sm font-semibold text-blue-900">{selected.size} selecionada(s)</p>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            <select
              value={batchStatus}
              onChange={(event) => setBatchStatus(event.target.value as typeof batchStatus)}
              className="min-h-11 rounded border border-blue-200 bg-white px-3 text-sm"
            >
              <option value="">Escolha a nova etapa</option>
              <option value="ABORDADO">Abordado</option>
              <option value="RESPONDEU">Respondeu</option>
              <option value="NEGOCIANDO">Negociando</option>
            </select>
            <button
              type="button"
              disabled={!batchStatus || batchBusy}
              onClick={() => void applyBatchStatus()}
              className="min-h-11 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {batchBusy ? "Aplicando..." : "Aplicar com confirmação"}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-error">
          {error} <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Tentar novamente</button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-28 rounded" />)}</div>
      ) : error && items.length === 0 ? null : items.length === 0 ? (
        <section className="panel rounded px-5 py-12 text-center">
          <UserRound className="mx-auto h-9 w-9 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Nenhuma oportunidade neste recorte</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Oportunidades aparecem quando um comentário ou Direct é observado. Ajuste os filtros ou revise sua primeira campanha.
          </p>
          <Link href="/campaigns/new" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
            Criar campanha <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      ) : view === "list" ? (
        <section className="panel overflow-hidden rounded">
          <div className="hidden grid-cols-[32px_minmax(260px,1fr)_140px_170px_130px_36px] items-center gap-4 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
            <span />
            <span>Contato e origem</span>
            <span>Etapa</span>
            <span>Responsável</span>
            <span>Valor potencial</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {items.map((item) => (
              <article key={item.id} className="grid gap-3 p-4 lg:grid-cols-[32px_minmax(260px,1fr)_140px_170px_130px_36px] lg:items-center lg:gap-4">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  aria-label={`Selecionar oportunidade de ${item.person.name ?? item.person.id}`}
                  className="h-4 w-4 rounded border-border"
                />
                <OpportunitySummary opportunity={item} referenceTime={loadedAt} />
                <div><StatusPill status={item.status} /></div>
                <p className="truncate text-sm text-muted">{item.assignee?.user.name ?? item.assignee?.user.email ?? "Sem responsável"}</p>
                <p className="text-sm font-semibold text-foreground">{formatMoney(item.commercial.potentialValueCents)}</p>
                <Link href={`/opportunities/${item.id}`} aria-label="Abrir oportunidade" className="inline-flex h-9 w-9 items-center justify-center rounded text-accent hover:bg-blue-50">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" aria-label="Kanban de oportunidades">
          <div className="grid min-w-[1780px] grid-cols-6 gap-3">
            {columns.map((column) => (
              <div key={column.status} className="rounded-lg bg-zinc-100 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <StatusPill status={column.status} />
                  <span className="text-xs font-semibold text-muted">{column.items.length}</span>
                </div>
                <div className="space-y-3">
                  {column.items.length === 0 && <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-muted">Sem oportunidades</p>}
                  {column.items.map((item) => (
                    <article key={item.id} className="rounded border border-border bg-white p-4 shadow-sm">
                      <OpportunitySummary opportunity={item} referenceTime={loadedAt} />
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="truncate text-xs text-muted">{item.assignee?.user.name ?? "Sem responsável"}</p>
                        <Link href={`/opportunities/${item.id}`} className="text-xs font-semibold text-accent hover:underline">Abrir</Link>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {nextCursor && !loading && (
        <div className="text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(nextCursor)}
            className="min-h-11 rounded border border-border bg-surface px-5 text-sm font-semibold hover:border-border-hover disabled:opacity-50"
          >
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
