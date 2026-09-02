"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  RefreshCw,
} from "lucide-react";

type ReadinessStatus = "available" | "unavailable" | "meta";

interface ReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

interface InstagramAccountSummary {
  id: string;
  username: string;
  tokenExpiresAt?: string | null;
  webhookSubscribed?: boolean;
}

const STATUS_COPY: Record<ReadinessStatus, string> = {
  available: "Disponível",
  unavailable: "Indisponível",
  meta: "Dependente da Meta",
};

function StatusIcon({ status }: { status: ReadinessStatus }) {
  if (status === "available") {
    return <CircleCheck className="h-5 w-5 text-success" aria-hidden="true" />;
  }
  if (status === "meta") {
    return <CircleHelp className="h-5 w-5 text-warning" aria-hidden="true" />;
  }
  return <CircleAlert className="h-5 w-5 text-error" aria-hidden="true" />;
}

function statusClass(status: ReadinessStatus) {
  if (status === "available") return "bg-success/10 text-success";
  if (status === "meta") return "bg-warning/10 text-warning";
  return "bg-error/10 text-error";
}

export default function OnboardingReadiness() {
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [account, setAccount] = useState<InstagramAccountSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const statsResponse = await fetch("/api/dashboard/stats", {
          cache: "no-store",
          signal: controller.signal,
        });
        const stats = await statsResponse.json();
        if (!statsResponse.ok || !stats.success) {
          throw new Error("Não foi possível verificar a conexão do Instagram.");
        }

        const selected = (stats.data.instagramAccount ??
          stats.data.instagramAccounts?.[0] ??
          null) as InstagramAccountSummary | null;
        setAccount(selected);

        const next: ReadinessItem[] = [
          {
            id: "connection",
            label: "Conexão da conta",
            status: selected ? "available" : "unavailable",
            detail: selected
              ? `Conta @${selected.username} encontrada no workspace.`
              : "Nenhuma conta profissional foi conectada.",
          },
          {
            id: "permissions",
            label: "Permissões da Meta",
            status: "meta",
            detail:
              "O app ainda não mantém um inventário dos escopos concedidos. A Meta confirma cada permissão ao executar a ação.",
          },
        ];

        if (selected) {
          next.push({
            id: "webhook",
            label: "Assinatura do webhook",
            status: selected.webhookSubscribed ? "available" : "unavailable",
            detail: selected.webhookSubscribed
              ? "A assinatura foi registrada. Este estado não confirma a chegada recente de eventos."
              : "A conta não registra uma assinatura de webhook ativa.",
          });

          const expiry = selected.tokenExpiresAt
            ? new Date(selected.tokenExpiresAt)
            : null;
          const tokenAvailable = Boolean(
            expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() > Date.now()
          );
          next.push({
            id: "token",
            label: "Token de acesso",
            status: tokenAvailable ? "available" : "unavailable",
            detail: tokenAvailable
              ? `Validade registrada até ${expiry?.toLocaleDateString("pt-BR")}.`
              : "Não há uma validade futura confirmada. Reconecte a conta antes de ativar.",
          });
        } else {
          next.push(
            {
              id: "webhook",
              label: "Assinatura do webhook",
              status: "unavailable",
              detail: "Conecte uma conta para registrar e verificar a assinatura.",
            },
            {
              id: "token",
              label: "Token de acesso",
              status: "unavailable",
              detail: "Conecte uma conta para obter um token.",
            }
          );
        }

        const [healthResult, postsResult] = await Promise.allSettled([
          fetch("/api/health", { cache: "no-store", signal: controller.signal }).then(
            async (response) => ({ response, payload: await response.json() })
          ),
          selected
            ? fetch(
                `/api/instagram/posts?${new URLSearchParams({
                  instagramAccountId: selected.id,
                  limit: "1",
                })}`,
                { cache: "no-store", signal: controller.signal }
              ).then(async (response) => ({ response, payload: await response.json() }))
            : Promise.resolve(null),
        ]);

        if (healthResult.status === "fulfilled") {
          const workerHealthy = Boolean(
            healthResult.value.payload?.checks?.worker?.healthy
          );
          next.push({
            id: "worker",
            label: "Processador de automações",
            status: workerHealthy ? "available" : "unavailable",
            detail: workerHealthy
              ? "O heartbeat atual confirma um processador ativo."
              : "O processador não está saudável ou não pôde ser confirmado.",
          });
        } else {
          next.push({
            id: "worker",
            label: "Processador de automações",
            status: "unavailable",
            detail: "Não foi possível consultar o heartbeat agora.",
          });
        }

        if (!selected) {
          next.push({
            id: "posts",
            label: "Publicações",
            status: "unavailable",
            detail: "Conecte uma conta para carregar publicações.",
          });
        } else if (postsResult.status === "fulfilled" && postsResult.value) {
          const { response, payload } = postsResult.value;
          if (response.ok && payload.success) {
            const count = Array.isArray(payload.data) ? payload.data.length : 0;
            next.push({
              id: "posts",
              label: "Publicações",
              status: count > 0 ? "available" : "unavailable",
              detail:
                count > 0
                  ? "A Meta retornou ao menos uma publicação selecionável."
                  : "A Meta respondeu, mas não retornou publicações para esta conta.",
            });
          } else {
            next.push({
              id: "posts",
              label: "Publicações",
              status: "meta",
              detail:
                "A Meta não liberou a lista agora. Isso pode depender de permissão, token ou disponibilidade externa.",
            });
          }
        } else {
          next.push({
            id: "posts",
            label: "Publicações",
            status: "meta",
            detail: "Não foi possível confirmar a biblioteca na Meta agora.",
          });
        }

        if (!controller.signal.aborted) setItems(next);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível verificar a prontidão."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [refreshKey]);

  const unavailableCount = items.filter(
    (item) => item.status === "unavailable"
  ).length;

  return (
    <div className="space-y-6">
      <section className="panel rounded-xl p-5 sm:p-6" aria-labelledby="readiness-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Etapa 1
            </p>
            <h2 id="readiness-title" className="mt-1 text-lg font-semibold text-foreground">
              Confirme a prontidão da conta
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Estes estados vêm das integrações disponíveis agora. Nenhuma
              resposta de teste é enviada por esta verificação.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Verificar novamente
          </button>
        </div>

        {loading && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2" role="status" aria-label="Verificando integração">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-error/20 bg-error/10 p-4" role="alert">
            <p className="text-sm font-semibold text-foreground">Verificação incompleta</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(item.status)}`}>
                        {STATUS_COPY[item.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{item.detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !error && unavailableCount > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm text-foreground">
              Há {unavailableCount} {unavailableCount === 1 ? "item indisponível" : "itens indisponíveis"}. Você pode preparar uma campanha pausada, mas revise a conexão antes de ativar.
            </p>
            <Link href="/settings" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
              Abrir configurações
            </Link>
          </div>
        )}

        {!loading && !error && !account && (
          <a href="/api/instagram/connect" className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover">
            Conectar Instagram
          </a>
        )}
      </section>

      <section className="panel rounded-xl p-5 sm:p-6" aria-labelledby="first-result-title">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Etapa 2</p>
        <h2 id="first-result-title" className="mt-1 text-lg font-semibold text-foreground">Prepare seu primeiro resultado</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Escolha um ponto de partida. O modelo abre editável, passa por revisão visual e sempre é salvo pausado antes de qualquer ativação.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link href="/campaigns/new?template=dtc-product-link" className="min-h-28 rounded-lg border border-border p-4 transition-colors hover:border-accent/40 hover:bg-accent/5">
            <span className="text-sm font-semibold text-foreground">Vender um produto</span>
            <span className="mt-2 block text-xs leading-relaxed text-muted">Preço, disponibilidade e link de compra.</span>
          </Link>
          <Link href="/campaigns/new?template=fitness-plan" className="min-h-28 rounded-lg border border-border p-4 transition-colors hover:border-accent/40 hover:bg-accent/5">
            <span className="text-sm font-semibold text-foreground">Entregar um material</span>
            <span className="mt-2 block text-xs leading-relaxed text-muted">Guia, catálogo, aula ou conteúdo prometido.</span>
          </Link>
          <Link href="/campaigns/new?template=real-estate-lead-form" className="min-h-28 rounded-lg border border-border p-4 transition-colors hover:border-accent/40 hover:bg-accent/5">
            <span className="text-sm font-semibold text-foreground">Captar interessados</span>
            <span className="mt-2 block text-xs leading-relaxed text-muted">Detalhes, formulário ou início de conversa.</span>
          </Link>
        </div>
        <Link href="/campaigns/new" className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover">
          Criar campanha do zero
        </Link>
      </section>
    </div>
  );
}
