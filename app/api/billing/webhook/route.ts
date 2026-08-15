import type Stripe from "stripe";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { requireEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing/subscription";

export const runtime = "nodejs";

function objectId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      requireEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch {
    return Response.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  let workspaceId: string | null = null;
  if (event.type === "checkout.session.completed") {
    workspaceId = event.data.object.metadata?.workspaceId ?? null;
  }

  try {
    await prisma.billingEvent.create({
      data: {
        workspaceId,
        stripeEventId: event.id,
        type: event.type,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription, workspaceId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const customerId = objectId(event.data.object.customer);
        if (!customerId) break;
        const workspace = await prisma.workspace.findUnique({
          where: { stripeCustomerId: customerId },
          select: { stripeSubscriptionId: true },
        });
        if (workspace?.stripeSubscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(
            workspace.stripeSubscriptionId
          );
          await syncSubscription(subscription);
        }
        break;
      }
    }

    await prisma.billingEvent.update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date() },
    });
    return Response.json({ received: true });
  } catch (error) {
    await prisma.billingEvent.update({
      where: { stripeEventId: event.id },
      data: {
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });
    return Response.json({ error: "Falha ao processar evento" }, { status: 500 });
  }
}
