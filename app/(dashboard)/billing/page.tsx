import { BillingActions } from "@/components/billing-actions";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

const STATUS_LABELS = {
  NONE: "Sem assinatura",
  INCOMPLETE: "Pagamento incompleto",
  TRIALING: "Período de teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento pendente",
  UNPAID: "Não paga",
  PAUSED: "Pausada",
  CANCELED: "Cancelada",
} as const;

export default async function BillingPage() {
  const context = await getCurrentWorkspaceContext();
  if (!context) return null;
  const { workspace } = context;
  const active =
    workspace.subscriptionStatus === "ACTIVE" ||
    workspace.subscriptionStatus === "TRIALING";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-accent">OpenReply Completo</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Assinatura</h1>
        <p className="mt-2 text-sm text-muted">
          Um único plano, sem limites artificiais e com acesso a todos os recursos.
        </p>
      </div>

      <section className="panel rounded p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Plano completo</h2>
            <p className="mt-2 text-sm text-muted">Leads ilimitados · Automações ilimitadas · Acesso completo</p>
          </div>
          <div className="sm:text-right">
            <span className="text-4xl font-bold text-foreground">R$ 87</span>
            <span className="text-sm text-muted">/mês</span>
          </div>
        </div>

        <ul className="my-8 grid gap-3 text-sm text-foreground sm:grid-cols-2">
          <li>✓ Leads ilimitados</li>
          <li>✓ Automações ilimitadas</li>
          <li>✓ Contas e campanhas sem limite do plano</li>
          <li>✓ Caixa de entrada e relatórios completos</li>
          <li>✓ Integrações e webhooks</li>
          <li>✓ Todos os novos recursos incluídos</li>
        </ul>

        <div className="mb-6 flex items-center justify-between rounded border border-border bg-surface-hover p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
            <p className={`mt-1 text-sm font-semibold ${active ? "text-success" : "text-foreground"}`}>
              {STATUS_LABELS[workspace.subscriptionStatus]}
              {workspace.cancelAtPeriodEnd ? " · encerra no fim do período" : ""}
            </p>
          </div>
          {workspace.subscriptionPeriodEnd && (
            <p className="text-xs text-muted">
              Até {workspace.subscriptionPeriodEnd.toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {context.role === "OWNER" ? (
          <BillingActions hasCustomer={Boolean(workspace.stripeCustomerId)} />
        ) : (
          <p className="text-sm text-muted">Somente o proprietário pode gerenciar a assinatura.</p>
        )}
      </section>

      <p className="text-center text-xs text-muted">
        Pagamento processado com segurança pela Stripe. Cancele quando quiser pelo portal do cliente.
      </p>
    </div>
  );
}
