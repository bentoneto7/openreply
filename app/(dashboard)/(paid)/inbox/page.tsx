"use client";

/**
 * Oportunidades
 *
 * Instagram DM conversations for the selected account, with live message
 * history and a reply composer. Messages are read from the Conversations API
 * (Meta only exposes the 20 most recent per thread) and refreshed by polling.
 * Sending is subject to Instagram's 24-hour messaging window — Meta's error is
 * surfaced verbatim when it applies.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { readCache, writeCache } from "@/lib/client-cache";
import type { ConversationListItem } from "@/app/api/instagram/conversations/route";
import type { ThreadMessage } from "@/app/api/instagram/conversations/[id]/route";
import {
  COMMERCIAL_STATUS_LABEL,
  INTENT_LABEL,
  type CommercialStatus,
  type Opportunity,
} from "@/lib/crm/client-types";
import {
  generateCommercialCopilot,
  type CommercialCopilotOutput,
} from "@/lib/crm/copilot";

const POLL_MS = 12_000;
// Cached list/threads are shown instantly on revisit, then revalidated in the
// background. The Instagram Conversations API is slow (often several seconds),
// so this is what makes the inbox feel fast after the first load.
const CACHE_MAX_AGE_MS = 60_000;
const convCacheKey = (accountId: string) => `inbox:convs:${accountId}`;
const msgCacheKey = (accountId: string, conversationId: string) =>
  `inbox:msgs:${accountId}:${conversationId}`;

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CopilotPanel({
  output,
  canUseDraft,
  onUseDraft,
}: {
  output: CommercialCopilotOutput;
  canUseDraft: boolean;
  onUseDraft: (value: string) => void;
}) {
  const drafts = [
    { label: "Curto", value: output.drafts.short },
    { label: "Consultivo", value: output.drafts.consultative },
    { label: "Direto", value: output.drafts.direct },
  ];

  return (
    <section className="rounded border border-blue-200 bg-blue-50/60 p-3" aria-labelledby="copilot-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="copilot-title" className="text-sm font-semibold text-blue-950">Copiloto comercial</h3>
        <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">Fallback local</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-blue-950">{output.summary}</p>
      {output.observedObjection && <p className="mt-2 text-xs leading-5 text-blue-900"><strong>Objeção observada:</strong> {output.observedObjection}</p>}
      <p className="mt-2 text-xs leading-5 text-blue-900"><strong>Pergunta sugerida:</strong> {output.qualificationQuestion}</p>
      <div className="mt-3 space-y-2">
        {drafts.map((item) => (
          <div key={item.label} className="rounded border border-blue-100 bg-white p-2.5">
            <p className="text-xs leading-5 text-foreground">{item.value}</p>
            <button
              type="button"
              disabled={!canUseDraft}
              onClick={() => onUseDraft(item.value)}
              className="mt-2 min-h-9 rounded border border-blue-200 px-3 text-xs font-semibold text-accent hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Usar rascunho {item.label.toLocaleLowerCase("pt-BR")}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-blue-900"><strong>Próximo passo:</strong> {output.recommendation.text}</p>
      <p className="mt-2 text-xs leading-5 text-blue-800">Regras determinísticas, sem provedor externo. Revisão e ação humana são obrigatórias; nenhum rascunho é enviado automaticamente.</p>
    </section>
  );
}

export default function InboxPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountsReloadKey, setAccountsReloadKey] = useState(0);
  // Só restaure a seleção depois de a API confirmar que a conta pertence ao
  // workspace atual. sessionStorage sobrevive a logout/login na mesma aba.
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [commercial, setCommercial] = useState<Opportunity | null>(null);
  const [commercialLoading, setCommercialLoading] = useState(false);
  const [commercialError, setCommercialError] = useState<string | null>(null);
  const [commercialSaving, setCommercialSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const pendingContactRef = useRef<string | null>(null);
  const deepLinkHandledRef = useRef(false);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeContactId = active?.contact.id ?? null;
  const copilot = useMemo(() => commercial ? generateCommercialCopilot({
    history: messages.map((message) => ({
      role: message.fromMe ? "business" as const : "contact" as const,
      content: message.text,
    })),
    intentCategory: commercial.intent.category,
    signals: commercial.intent.signals,
    status: commercial.status,
    offer: commercial.commercial.productOffer,
    nextAction: commercial.commercial.nextAction,
  }) : null, [commercial, messages]);
  const canUseCopilotDraft = Boolean(
    commercial && commercial.status !== "GANHO" && commercial.status !== "PERDIDO"
  );

  function useCopilotDraft(value: string) {
    setDraft(value);
    composerRef.current?.focus();
  }

  // Accounts for the selector; default to the first connected account. Uses the
  // lightweight accounts endpoint (one query) rather than the heavy dashboard
  // stats aggregation, so the inbox isn't gated on analytics before it can load.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/instagram/accounts")
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Não foi possível carregar as contas conectadas");
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        const next: AccountOption[] = payload.data.instagramAccounts ?? [];
        const params = new URLSearchParams(window.location.search);
        const requestedAccountId = params.get("instagramAccountId");
        const requestedContactId = params.get("contact");
        const requestedAccountIsValid = Boolean(
          requestedAccountId && next.some((account) => account.id === requestedAccountId)
        );

        pendingContactRef.current = requestedAccountIsValid ? requestedContactId : null;
        deepLinkHandledRef.current = false;
        setDeepLinkError(
          requestedAccountId && !requestedAccountIsValid
            ? "A conta indicada pela oportunidade não está disponível neste workspace."
            : null
        );
        setAccounts(next);
        setSelectedAccountId(() => {
          const remembered = window.sessionStorage.getItem(
            "inbox:selectedAccount"
          );
          const stillValid =
            remembered && next.some((account) => account.id === remembered);
          return requestedAccountIsValid
            ? requestedAccountId ?? ""
            : stillValid
            ? remembered
            : payload.data.selectedInstagramAccountId || next[0]?.id || "";
        });
        setAccountsStatus("ready");
        if (next.length === 0) setConvLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setAccounts([]);
        setSelectedAccountId("");
        setConvLoading(false);
        setAccountsError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as contas conectadas"
        );
        setAccountsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [accountsReloadKey]);

  // Remember the chosen account for the next visit.
  useEffect(() => {
    if (typeof window === "undefined" || !selectedAccountId) return;
    window.sessionStorage.setItem("inbox:selectedAccount", selectedAccountId);
  }, [selectedAccountId]);

  const loadConversations = useCallback(
    async (silent: boolean) => {
      if (!selectedAccountId) return;
      if (!silent) setConvLoading(true);
      try {
        const res = await fetch(
          `/api/instagram/conversations?instagramAccountId=${selectedAccountId}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (res.ok && data.success) {
          const nextConversations = data.data.conversations as ConversationListItem[];
          setConversations(nextConversations);
          writeCache(convCacheKey(selectedAccountId), nextConversations);
          setConvError(null);
          const pendingContact = pendingContactRef.current;
          if (pendingContact && !deepLinkHandledRef.current) {
            deepLinkHandledRef.current = true;
            const match = nextConversations.find(
              (conversation) => conversation.contact.id === pendingContact
            );
            if (match) {
              setActiveId(match.id);
              setDeepLinkError(null);
            } else {
              setDeepLinkError(
                "A conversa desta oportunidade não foi encontrada entre as conversas disponíveis da conta."
              );
            }
          }
        } else if (!silent) {
          setConvError(data.error ?? "Não foi possível carregar as conversas");
        }
      } catch {
        if (!silent) setConvError("Não foi possível carregar as conversas");
      } finally {
        if (!silent) setConvLoading(false);
      }
    },
    [selectedAccountId]
  );

  // Load + poll conversations for the selected account. A cached list is shown
  // immediately (so revisits are instant) while a fresh copy loads silently.
  useEffect(() => {
    if (!selectedAccountId) return;
    // Reset the open thread when switching accounts. This is an intentional
    // synchronous reset on a dependency change, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(null);
    setMessages([]);
    setThreadError(null);
    const cached = readCache<ConversationListItem[]>(
      convCacheKey(selectedAccountId),
      CACHE_MAX_AGE_MS
    );
    if (cached.data) {
      setConversations(cached.data);
      setConvLoading(false);
    } else {
      setConversations([]);
      setConvLoading(true);
    }
    void loadConversations(Boolean(cached.data));
    const timer = window.setInterval(() => void loadConversations(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [selectedAccountId, loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: string, silent: boolean) => {
      if (!selectedAccountId) return;
      if (!silent) setThreadLoading(true);
      try {
        const res = await fetch(
          `/api/instagram/conversations/${conversationId}?instagramAccountId=${selectedAccountId}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error ?? "Não foi possível carregar as mensagens");
        }
        setMessages(data.data.messages);
        setThreadError(null);
        writeCache(
          msgCacheKey(selectedAccountId, conversationId),
          data.data.messages
        );
      } catch (loadError) {
        setThreadError(
          loadError instanceof Error
            ? loadError.message
            : silent
              ? "Não foi possível atualizar as mensagens"
              : "Não foi possível carregar as mensagens"
        );
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [selectedAccountId]
  );

  // Load + poll the open thread. Cached messages render instantly while a fresh
  // copy loads silently; opening a thread never shows a blank pane on revisit.
  useEffect(() => {
    if (!activeId) return;
    const cached = readCache<ThreadMessage[]>(
      msgCacheKey(selectedAccountId, activeId),
      CACHE_MAX_AGE_MS
    );
    if (cached.data) {
      // Paint cached messages instantly on thread change; intentional reset.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(cached.data);
      setThreadLoading(false);
    } else {
      setMessages([]);
      setThreadLoading(true);
    }
    void loadMessages(activeId, Boolean(cached.data));
    const timer = window.setInterval(
      () => void loadMessages(activeId, true),
      POLL_MS
    );
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages, selectedAccountId]);

  // Une a conversa ao registro comercial persistido pelo par exato de pessoa
  // e conta, sem depender de busca textual ou de resultados aproximados.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!activeContactId || !selectedAccountId) {
        setCommercial(null);
        setCommercialError(null);
        setCommercialLoading(false);
        return;
      }
      setCommercialLoading(true);
      setCommercialError(null);
      const params = new URLSearchParams({
        instagramAccountId: selectedAccountId,
        commenterId: activeContactId,
        limit: "1",
      });
      fetch(`/api/opportunities?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.error ?? "Não foi possível carregar o contexto comercial");
          const item = (payload.data.items as Opportunity[])[0];
          setCommercial(item ?? null);
        })
        .catch((loadError) => {
          if (loadError instanceof DOMException && loadError.name === "AbortError") return;
          setCommercialError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o contexto comercial");
        })
        .finally(() => { if (!controller.signal.aborted) setCommercialLoading(false); });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeContactId, selectedAccountId]);

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function openConversation(id: string) {
    setActiveId(id);
    setSendError(null);
    setThreadError(null);
    // Paint any cached thread synchronously so the pane never flashes empty
    // or shows the previously open conversation while the fetch runs.
    const cached = readCache<ThreadMessage[]>(
      msgCacheKey(selectedAccountId, id),
      CACHE_MAX_AGE_MS
    );
    setMessages(cached.data ?? []);
    setThreadLoading(!cached.data);
  }

  function chooseAccount(id: string) {
    pendingContactRef.current = null;
    deepLinkHandledRef.current = true;
    setDeepLinkError(null);
    setSelectedAccountId(id);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !active?.contact.id || sending) return;
    setSending(true);
    setSendError(null);

    // Optimistically show the reply immediately, then confirm with the server.
    const optimistic: ThreadMessage = {
      id: `optimistic-${Date.now()}`,
      text,
      fromMe: true,
      fromUsername: null,
      createdTime: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const res = await fetch("/api/instagram/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          conversationId: active.id,
          recipientId: active.contact.id,
          text,
        }),
      });
      if (!res.ok) {
        const failure = await res.json().catch(() => null);
        setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
        setDraft(text);
        setSendError(failure?.error ?? "Não foi possível enviar a mensagem");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data?.success) {
        setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
        setDraft(text);
        setSendError(data?.error ?? "Não foi possível enviar a mensagem");
        return;
      }
      await loadMessages(active.id, true);
      void loadConversations(true);
    } catch (sendFailure) {
      // Roll the optimistic message back and restore the draft so it's not lost.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setSendError(
        sendFailure instanceof Error
          ? sendFailure.message
          : "Não foi possível enviar a mensagem"
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function updateCommercialStatus(status: CommercialStatus) {
    if (!commercial || commercialSaving || status === commercial.status) return;
    setCommercialSaving(true);
    setCommercialError(null);
    try {
      const response = await fetch(`/api/opportunities/${commercial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: commercial.version,
          idempotencyKey: `inbox-${crypto.randomUUID()}`,
          status,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Não foi possível alterar a etapa");
      setCommercial(payload.data.opportunity);
    } catch (statusError) {
      setCommercialError(statusError instanceof Error ? statusError.message : "Não foi possível alterar a etapa");
    } finally {
      setCommercialSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Atendimento humano</p><h1 className="mt-1 text-lg font-semibold text-foreground">Conversas</h1></div>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={chooseAccount}
            includeAll={false}
          />
        )}
      </div>

      {accountsStatus === "loading" && (
        <div role="status" className="rounded border border-border bg-surface px-4 py-5 text-sm text-muted">
          Carregando contas conectadas…
        </div>
      )}
      {accountsStatus === "error" && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-4 text-sm text-error">
          {accountsError ?? "Não foi possível carregar as contas conectadas."}
          <button
            type="button"
            onClick={() => {
              setAccountsStatus("loading");
              setAccountsError(null);
              setDeepLinkError(null);
              setAccountsReloadKey((value) => value + 1);
            }}
            className="ml-2 font-semibold underline"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {accountsStatus === "ready" && accounts.length === 0 && (
        <section className="rounded border border-border bg-surface px-5 py-8 text-center">
          <h2 className="text-base font-semibold text-foreground">Nenhuma conta do Instagram conectada</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Conecte uma conta profissional para carregar conversas. Nenhuma ausência de mensagem foi inferida.</p>
          <a href="/api/instagram/connect" className="mt-4 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Conectar Instagram</a>
        </section>
      )}
      {deepLinkError && (
        <div role="alert" className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {deepLinkError} Você ainda pode selecionar outra conversa abaixo.
        </div>
      )}

      {accountsStatus === "ready" && accounts.length > 0 && (
      <div className="grid h-[calc(100dvh-10rem)] grid-cols-1 overflow-hidden rounded border border-border sm:grid-cols-[300px_1fr] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Conversation list. On mobile it takes the full pane and is hidden
            once a thread is open (ManyChat-style); on sm+ it is always shown. */}
        <div
          className={`min-h-0 flex-col border-b border-border sm:flex sm:border-b-0 sm:border-r ${
            active ? "hidden" : "flex"
          }`}
        >
          <div className="shrink-0 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            Conversas
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {convLoading ? (
              <p className="px-4 py-6 text-sm text-muted">Carregando…</p>
            ) : convError ? (
              <div role="alert" className="px-4 py-6 text-sm text-error">
                {convError}
                <button type="button" onClick={() => void loadConversations(false)} className="mt-2 block font-semibold underline">Tentar novamente</button>
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Nenhuma conversa encontrada.</p>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className={`block w-full border-b border-border px-4 py-3 text-left ${
                      isActive ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        @{c.contact.username ?? "contato"}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {formatTime(c.updatedTime)}
                      </span>
                    </div>
                    {c.lastMessage && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {c.lastMessage.fromMe ? "Você: " : ""}
                        {c.lastMessage.text || "(mensagem sem texto)"}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread. On mobile it is only shown once a conversation is open and
            fills the pane; on sm+ it always sits beside the list. */}
        <div
          className={`min-h-0 flex-col ${active ? "flex" : "hidden sm:flex"}`}
        >
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted">
              Selecione uma conversa para ler e responder.
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="-ml-1 rounded px-2 py-1 text-muted hover:text-foreground sm:hidden"
                  aria-label="Voltar para conversas"
                >
                  Voltar
                </button>
                <span className="truncate">
                  @{active.contact.username ?? "contato"}
                </span>
              </div>

              <div ref={scrollRef} role="log" aria-live="polite" aria-label="Mensagens da conversa" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {threadError && (
                  <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-error">
                    {threadError}
                    <button type="button" onClick={() => void loadMessages(active.id, false)} className="ml-2 font-semibold underline">Tentar novamente</button>
                  </div>
                )}
                {threadLoading && messages.length === 0 ? (
                  <p className="text-sm text-muted">Carregando…</p>
                ) : messages.length === 0 ? (
                  !threadError && <p className="text-sm text-muted">Nenhuma mensagem disponível.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          m.fromMe
                            ? "bg-accent text-white"
                            : "bg-surface text-foreground border border-border"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            m.fromMe ? "text-white/70" : "text-zinc-500"
                          }`}
                        >
                          {formatTime(m.createdTime)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-border p-3">
                {sendError && (
                  <p role="alert" className="mb-2 text-xs text-error">{sendError}</p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={composerRef}
                    aria-label={`Resposta para ${active.contact.username ?? "contato"}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Escreva uma resposta… (Enter envia; Shift+Enter quebra a linha)"
                    className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    {sending ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="hidden min-h-0 flex-col border-l border-border bg-surface xl:flex" aria-label="Contexto comercial da conversa">
          <div className="border-b border-border px-4 py-3"><p className="text-sm font-semibold">Contexto comercial</p><p className="mt-1 text-xs text-muted">Persistido no workspace</p></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!active ? <p className="text-sm text-muted">Selecione uma conversa para ver origem, intenção e próxima ação.</p> : commercialLoading ? <p className="text-sm text-muted">Carregando contexto…</p> : commercialError ? <p role="alert" className="text-sm text-error">{commercialError}</p> : !commercial ? <div><p className="text-sm font-semibold">Contexto ainda indisponível</p><p className="mt-2 text-xs leading-5 text-muted">Esta conversa ainda não possui uma oportunidade persistida. Nada foi inferido como venda ou lead qualificado.</p></div> : <div className="space-y-5">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Etapa</p><select aria-label="Etapa comercial" value={commercial.status} disabled={commercialSaving} onChange={(event) => void updateCommercialStatus(event.target.value as CommercialStatus)} className="mt-2 min-h-10 w-full rounded border border-border bg-surface px-3 text-sm disabled:opacity-50"><option value="NOVO">Novo</option><option value="ABORDADO">Abordado</option><option value="RESPONDEU">Respondeu</option><option value="NEGOCIANDO">Negociando</option>{(commercial.status === "GANHO" || commercial.status === "PERDIDO") && <option value={commercial.status} disabled>{COMMERCIAL_STATUS_LABEL[commercial.status]} — edite no detalhe</option>}</select><p className="mt-2 text-xs text-muted">Ganho e perda exigem confirmação no detalhe.</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Intenção observada</p><p className="mt-1 text-sm font-semibold">{INTENT_LABEL[commercial.intent.category ?? "UNKNOWN"]}</p><p className="mt-1 text-xs leading-5 text-muted">{commercial.intent.signals.length ? `Sinais: ${commercial.intent.signals.join(", ").replaceAll("_", " ")}` : "Sem sinais explicáveis registrados."}</p></div>
              {copilot && <CopilotPanel output={copilot} canUseDraft={canUseCopilotDraft} onUseDraft={useCopilotDraft} />}
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Origem</p><p className="mt-1 text-sm">{commercial.sourceAutomation?.name ?? "Sem campanha vinculada"}</p><p className="mt-1 text-xs text-muted">{commercial.origin.keyword ? `Palavra-chave: ${commercial.origin.keyword}` : "Palavra-chave não identificada"}</p>{commercial.origin.text && <p className="mt-2 rounded bg-zinc-50 p-3 text-xs leading-5 text-muted">“{commercial.origin.text}”</p>}</div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Responsável</p><p className="mt-1 text-sm">{commercial.assignee?.user.name ?? commercial.assignee?.user.email ?? "Sem responsável"}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Próxima ação</p><p className="mt-1 text-sm">{commercial.commercial.nextAction ?? "Não definida"}</p>{commercial.commercial.nextActionAt && <p className="mt-1 text-xs text-muted">{new Date(commercial.commercial.nextActionAt).toLocaleString("pt-BR")}</p>}</div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Links e cliques por contato</p><p className="mt-1 text-xs leading-5 text-muted">Não disponíveis neste contrato. Nenhum clique é apresentado como compra.</p></div>
              <Link href={`/opportunities/${commercial.id}`} className="inline-flex min-h-11 w-full items-center justify-center rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Abrir oportunidade completa</Link>
            </div>}
          </div>
        </aside>
      </div>
      )}

      {active && commercial && <div className="rounded border border-border bg-surface p-3 xl:hidden"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted">{COMMERCIAL_STATUS_LABEL[commercial.status]} · {INTENT_LABEL[commercial.intent.category ?? "UNKNOWN"]}</p><p className="mt-1 text-sm font-semibold">{commercial.commercial.nextAction ?? "Próxima ação não definida"}</p></div><Link href={`/opportunities/${commercial.id}`} className="text-sm font-semibold text-accent hover:underline">Ver contexto</Link></div>{copilot && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-accent">Abrir copiloto comercial</summary><div className="mt-3"><CopilotPanel output={copilot} canUseDraft={canUseCopilotDraft} onUseDraft={useCopilotDraft} /></div></details>}</div>}

      <aside className="rounded border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">As mensagens só são enviadas depois do clique humano em “Enviar”. Sugestões e rascunhos nunca disparam respostas automaticamente.</aside>
    </div>
  );
}
