import type Stripe from "stripe";
import type { SubscriptionStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";

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
