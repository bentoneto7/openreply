import type Stripe from "stripe";
import type { SubscriptionStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { isBillingEnforcementEnabled } from "@/lib/env";

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "UNPAID",
  paused: "PAUSED",
};

function stripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function hasPaidAccess(status: SubscriptionStatus): boolean {
  return status === "ACTIVE" || status === "TRIALING";
}

/**
 * The single answer to "what does this workspace still have to do before the
 * tool is theirs?" — cadastro, conectar o Instagram, pagar, nessa ordem.
 *
 * Returns the path to send them to, or null when nothing is pending. Every
 * gated screen routes through this, so the funnel order lives here and nowhere
 * else. With enforcement off it never gates: local and self-hosted runs behave
 * exactly as they do today, and the flag doubles as a kill switch if Stripe
 * stops reporting status correctly.
 */
export function nextOnboardingStep(
  state: { instagramConnected: boolean; subscriptionStatus: SubscriptionStatus },
  enforcing: boolean = isBillingEnforcementEnabled()
): "/settings" | "/billing" | null {
  if (!enforcing) return null;
  if (!state.instagramConnected) return "/settings";
  if (!hasPaidAccess(state.subscriptionStatus)) return "/billing";
  return null;
}

export async function syncSubscription(
  subscription: Stripe.Subscription,
  fallbackWorkspaceId?: string | null
) {
  const customerId = stripeId(subscription.customer);
  const workspaceId =
    subscription.metadata.workspaceId || fallbackWorkspaceId || null;
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const priceId = subscription.items.data[0]?.price.id ?? null;

  const where = workspaceId
    ? { id: workspaceId }
    : customerId
      ? { stripeCustomerId: customerId }
      : null;

  if (!where) return null;

  return prisma.workspace.update({
    where,
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: STATUS_MAP[subscription.status],
      subscriptionPeriodEnd: periodEnd
        ? new Date(periodEnd * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}
