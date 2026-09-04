"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, MessageCircle, Save, UserRound } from "lucide-react";
import {
  COMMERCIAL_STATUSES,
  COMMERCIAL_STATUS_LABEL,
  INTENT_CATEGORIES,
  INTENT_LABEL,
  type CommercialStatus,
  type IntentCategory,
  type OpportunityDetail,
} from "@/lib/crm/client-types";

interface WorkspaceMembersPayload {
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  members: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    user: { id: string; email: string | null; name: string | null };
  }>;
}

type FormState = {
  status: CommercialStatus;
  note: string;
  assigneeMemberId: string;
  productOffer: string;
  potentialValue: string;
  nextAction: string;
  nextActionAt: string;
  lossReason: string;
  intentCategory: IntentCategory;
  saleAmount: string;
};

const EVENT_LABEL: Record<string, string> = {
  OBSERVED_COMMENT: "Comentário observado",
  OBSERVED_DM: "Mensagem recebida no Direct",
  STATUS_CHANGED: "Etapa alterada",
  ASSIGNEE_CHANGED: "Responsável alterado",
  COMMERCIAL_FIELDS_UPDATED: "Contexto comercial atualizado",
  INTENT_CLASSIFIED: "Intenção classificada",
  INTENT_CORRECTED: "Intenção corrigida por uma pessoa",
  SALE_CONFIRMED: "Venda confirmada",
  SALE_VOIDED: "Venda anulada",
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function moneyFromCents(value: number | null) {
  if (value == null) return "";
  return (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moneyToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function formatMoney(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value / 100);
}

function initialForm(opportunity: OpportunityDetail): FormState {
  return {
    status: opportunity.status,
    note: opportunity.note ?? "",
    assigneeMemberId: opportunity.assignee?.id ?? "",
    productOffer: opportunity.commercial.productOffer ?? "",
    potentialValue: moneyFromCents(opportunity.commercial.potentialValueCents),
    nextAction: opportunity.commercial.nextAction ?? "",
    nextActionAt: toDateTimeLocal(opportunity.commercial.nextActionAt),
    lossReason: opportunity.commercial.lossReason ?? "",
    intentCategory: opportunity.intent.category ?? "UNKNOWN",
    saleAmount: "",
  };
}

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [members, setMembers] = useState<WorkspaceMembersPayload | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [opportunityResponse, membersResponse] = await Promise.all([
        fetch(`/api/opportunities/${id}`, { cache: "no-store" }),
        fetch("/api/workspace/members", { cache: "no-store" }),
      ]);
      const opportunityPayload = await opportunityResponse.json();
      const membersPayload = await membersResponse.json();
      if (!opportunityResponse.ok || !opportunityPayload.success) {
        throw new Error(opportunityPayload.error ?? "Oportunidade não encontrada");
      }
      const next = opportunityPayload.data.opportunity as OpportunityDetail;
      setOpportunity(next);
      setForm(initialForm(next));
      if (membersResponse.ok && membersPayload.success) setMembers(membersPayload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a oportunidade");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const hasConfirmedSale = useMemo(
    () => opportunity?.sales.some((sale) => sale.status === "CONFIRMED") ?? false,
    [opportunity]
  );
  const terminalStatusLocked = hasConfirmedSale || opportunity?.status === "PERDIDO";

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!opportunity || !form) return;
    setError(null);
    setNotice(null);

    const potentialValueCents = form.potentialValue ? moneyToCents(form.potentialValue) : null;
    if (form.potentialValue && potentialValueCents == null) {
      setError("Informe um valor potencial válido.");
      return;
    }
    if (form.status === "PERDIDO" && !form.lossReason.trim()) {
      setError("Informe o motivo da perda antes de concluir.");
      return;
    }
    if (hasConfirmedSale && form.status !== "GANHO") {
      setError(
        "A etapa não pode sair de Ganho enquanto houver uma venda confirmada. A anulação auditada ainda não está disponível."
      );
      return;
    }
    if (opportunity.status === "PERDIDO" && form.status !== "PERDIDO") {
      setError(
        "Uma oportunidade perdida exige uma reabertura explícita e auditada, ainda não disponível."
      );
      return;
    }
    const saleAmountCents = form.saleAmount ? moneyToCents(form.saleAmount) : null;
    if (form.status === "GANHO" && !hasConfirmedSale && (!saleAmountCents || saleAmountCents < 1)) {
      setError("Informe o valor confirmado da venda antes de marcar como ganho.");
      return;
    }

    const body: Record<string, unknown> = {
      expectedVersion: opportunity.version,
      idempotencyKey: `detail-${crypto.randomUUID()}`,
    };
    if (form.status !== opportunity.status) body.status = form.status;
    if (form.note !== (opportunity.note ?? "")) body.note = form.note.trim() || null;
    if (form.assigneeMemberId !== (opportunity.assignee?.id ?? "")) body.assigneeMemberId = form.assigneeMemberId || null;
    if (form.productOffer !== (opportunity.commercial.productOffer ?? "")) body.productOffer = form.productOffer.trim() || null;
    if (potentialValueCents !== opportunity.commercial.potentialValueCents) body.potentialValueCents = potentialValueCents;
    if (form.nextAction !== (opportunity.commercial.nextAction ?? "")) body.nextAction = form.nextAction.trim() || null;
    if (form.nextActionAt !== toDateTimeLocal(opportunity.commercial.nextActionAt)) {
      body.nextActionAt = form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null;
    }
    if (form.lossReason !== (opportunity.commercial.lossReason ?? "")) body.lossReason = form.lossReason.trim() || null;
    if (form.intentCategory !== (opportunity.intent.category ?? "UNKNOWN")) body.intentCategory = form.intentCategory;
    if (form.status === "GANHO" && !hasConfirmedSale && saleAmountCents) {
      body.sale = { amountCents: saleAmountCents, currency: "BRL" };
    }

    if (Object.keys(body).length === 2) {
      setNotice("Nenhuma alteração para salvar.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        const conflict = payload.code === "VERSION_CONFLICT" ? " Recarregue para ver a versão mais recente." : "";
        throw new Error(`${payload.error ?? "Não foi possível salvar."}${conflict}`);
      }
      const next = payload.data.opportunity as OpportunityDetail;
      setOpportunity(next);
      setForm(initialForm(next));
      setNotice(payload.meta?.replayed ? "Alteração já havia sido aplicada." : "Oportunidade atualizada com histórico.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="grid gap-4 lg:grid-cols-3"><div className="panel h-80 rounded lg:col-span-2" /><div className="panel h-80 rounded" /></div>;
  if (!opportunity || !form) return (
    <div className="panel rounded p-8 text-center">
      <p role="alert" className="text-sm text-error">{error ?? "Oportunidade não encontrada"}</p>
      <Link href="/opportunities" className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline">Voltar ao pipeline</Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <Link href="/opportunities" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar às oportunidades
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Oportunidade</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">@{opportunity.person.name ?? opportunity.person.id}</h1>
            <p className="mt-1 text-sm text-muted">@{opportunity.instagramAccount.username} · {opportunity.sourceAutomation?.name ?? "Origem sem campanha"}</p>
          </div>
          <Link href={`/inbox?instagramAccountId=${encodeURIComponent(opportunity.instagramAccount.id)}&contact=${encodeURIComponent(opportunity.person.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-border bg-surface px-4 text-sm font-semibold hover:border-border-hover">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Abrir conversa
          </Link>
        </div>
      </header>

      {error && <div role="alert" className="rounded border border-error-subtle-border bg-error-subtle p-4 text-sm text-error">{error}</div>}
      {notice && <div role="status" className="rounded border border-success-subtle-border bg-success-subtle p-4 text-sm text-success-strong">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <form onSubmit={save} className="panel rounded p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Contexto comercial</h2>
              <p className="mt-1 text-sm text-muted">Cada alteração fica registrada no histórico.</p>
            </div>
            <span className="text-xs text-muted">versão {opportunity.version}</span>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">Etapa
              <select disabled={terminalStatusLocked} value={form.status} onChange={(event) => updateField("status", event.target.value as CommercialStatus)} className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-3 disabled:cursor-not-allowed disabled:opacity-60">
                {COMMERCIAL_STATUSES.map((status) => <option key={status} value={status}>{COMMERCIAL_STATUS_LABEL[status]}</option>)}
              </select>
              {hasConfirmedSale && (
                <span className="mt-2 block text-xs font-normal text-muted">
                  Venda confirmada: para preservar o histórico, esta etapa só pode mudar após uma anulação auditada.
                </span>
              )}
              {!hasConfirmedSale && opportunity.status === "PERDIDO" && (
                <span className="mt-2 block text-xs font-normal text-muted">
                  O motivo da perda permanece no histórico; a reabertura auditada ainda não está disponível.
                </span>
              )}
            </label>
            <label className="text-sm font-medium">Responsável
              <select value={form.assigneeMemberId} onChange={(event) => updateField("assigneeMemberId", event.target.value)} className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-3">
                <option value="">Sem responsável</option>
                {members?.members.map((member) => <option key={member.id} value={member.id}>{member.user.name ?? member.user.email ?? "Membro"}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Produto ou oferta
              <input value={form.productOffer} onChange={(event) => updateField("productOffer", event.target.value)} maxLength={500} className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-3" placeholder="Ex.: Consultoria comercial" />
            </label>
            <label className="text-sm font-medium">Valor potencial (R$)
              <input value={form.potentialValue} onChange={(event) => updateField("potentialValue", event.target.value)} inputMode="decimal" className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-3" placeholder="0,00" />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Próxima ação
              <input value={form.nextAction} onChange={(event) => updateField("nextAction", event.target.value)} maxLength={500} className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-3" placeholder="Ex.: Enviar proposta com duas opções" />
            </label>
            <label className="text-sm font-medium">Prazo da próxima ação
              <input type="datetime-local" value={form.nextActionAt} onChange={(event) => updateField("nextActionAt", event.target.value)} className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-3" />
            </label>
            <label className="text-sm font-medium">Intenção observada
              <select value={form.intentCategory} onChange={(event) => updateField("intentCategory", event.target.value as IntentCategory)} className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-3">
                {INTENT_CATEGORIES.map((category) => <option key={category} value={category}>{INTENT_LABEL[category]}</option>)}
              </select>
              <span className="mt-2 block text-xs font-normal text-muted">Corrigir aqui registra feedback humano; sinais automáticos não são verdade absoluta.</span>
            </label>
            <label className="text-sm font-medium sm:col-span-2">Nota interna
              <textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded border border-border bg-surface p-3" placeholder="Contexto útil para a próxima pessoa que atender" />
            </label>
            {form.status === "PERDIDO" && (
              <label className="text-sm font-medium sm:col-span-2">Motivo da perda
                <textarea required value={form.lossReason} onChange={(event) => updateField("lossReason", event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded border border-border bg-surface p-3" placeholder="O que impediu o avanço?" />
              </label>
            )}
            {form.status === "GANHO" && !hasConfirmedSale && (
              <label className="text-sm font-medium sm:col-span-2">Valor confirmado da venda (R$)
                <input required value={form.saleAmount} onChange={(event) => updateField("saleAmount", event.target.value)} inputMode="decimal" className="mt-2 min-h-11 w-full rounded border border-success-subtle-border bg-success-subtle px-3" placeholder="0,00" />
                <span className="mt-2 block text-xs font-normal text-muted">Esse valor cria um evento de venda confirmada. Clique e valor potencial não viram receita.</span>
              </label>
            )}
          </div>

          <button type="submit" disabled={saving} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 sm:w-auto">
            <Save className="h-4 w-4" aria-hidden="true" /> {saving ? "Salvando..." : "Salvar no histórico"}
          </button>
        </form>

        <div className="space-y-6">
          <section className="panel rounded p-4 sm:p-6">
            <h2 className="text-base font-semibold">Origem e sinais</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Comentário ou mensagem</dt><dd className="mt-1 text-foreground">{opportunity.origin.text ?? "Texto de origem indisponível"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Palavra-chave</dt><dd className="mt-1 text-foreground">{opportunity.origin.keyword ?? "Não identificada"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Classificação</dt><dd className="mt-1 text-foreground">{INTENT_LABEL[opportunity.intent.category ?? "UNKNOWN"]} · {opportunity.intent.source === "HUMAN" ? "corrigida por pessoa" : opportunity.intent.source === "RULE" ? "regra determinística" : "origem indisponível"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Sinais usados</dt><dd className="mt-2 flex flex-wrap gap-2">{opportunity.intent.signals.length ? opportunity.intent.signals.map((signal) => <span key={signal} className="rounded bg-surface-muted px-2 py-1 text-xs text-foreground">{signal.replaceAll("_", " ")}</span>) : <span className="text-muted">Nenhum sinal registrado</span>}</dd></div>
            </dl>
          </section>

          <section className="panel rounded p-4 sm:p-6">
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-accent" aria-hidden="true" /><h2 className="text-base font-semibold">Vendas confirmadas</h2></div>
            <div className="mt-4 space-y-3">
              {opportunity.sales.length === 0 && <p className="text-sm text-muted">Nenhuma venda confirmada. Isso é diferente de receita zero medida.</p>}
              {opportunity.sales.map((sale) => (
                <div key={sale.id} className="rounded border border-border p-3">
                  <div className="flex items-center justify-between gap-3"><strong className="text-sm">{formatMoney(sale.amountCents, sale.currency.trim())}</strong><span className={`text-xs font-semibold ${sale.status === "CONFIRMED" ? "text-success" : "text-muted"}`}>{sale.status === "CONFIRMED" ? "Confirmada" : "Anulada"}</span></div>
                  <p className="mt-1 text-xs text-muted">{new Date(sale.confirmedAt).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="panel rounded p-4 sm:p-6">
        <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-accent" aria-hidden="true" /><h2 className="text-base font-semibold">Histórico auditável</h2></div>
        <div className="mt-5 divide-y divide-border">
          {opportunity.events.length === 0 && <p className="py-6 text-sm text-muted">Nenhum evento registrado.</p>}
          {opportunity.events.map((event) => (
            <article key={event.id} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:gap-4">
              <div>
                <p className="text-sm font-semibold">{EVENT_LABEL[event.type] ?? event.type}</p>
                {event.fromStatus !== event.toStatus && event.toStatus && <p className="mt-1 text-xs text-muted">{event.fromStatus ? COMMERCIAL_STATUS_LABEL[event.fromStatus] : "Sem etapa"} → {COMMERCIAL_STATUS_LABEL[event.toStatus]}</p>}
                <p className="mt-1 text-xs text-muted">{event.actor?.user.name ?? "Sistema"}</p>
              </div>
              <time className="text-xs text-muted">{new Date(event.occurredAt).toLocaleString("pt-BR")}</time>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
