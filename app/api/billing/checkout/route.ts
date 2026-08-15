import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getBaseUrl } from "@/lib/env";
import { getStripe, getStripePriceId } from "@/lib/stripe";
import {
  canManageBilling,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const runtime = "nodejs";

export async function POST() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!canManageBilling(context.role)) {
    return NextResponse.json(
      { error: "Apenas o proprietário pode gerenciar a assinatura" },
      { status: 403 }
    );
  }

  const stripe = getStripe();
  let customerId = context.workspace.stripeCustomerId;

  if (!customerId) {
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { email: true, name: true },
    });
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      name: user?.name ?? context.workspace.name,
      metadata: { workspaceId: context.workspaceId },
    });
    customerId = customer.id;
    await prisma.workspace.update({
      where: { id: context.workspaceId },
      data: { stripeCustomerId: customerId },
    });
  }

  const baseUrl = getBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: context.workspaceId,
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/billing?checkout=success`,
    cancel_url: `${baseUrl}/billing?checkout=canceled`,
    metadata: { workspaceId: context.workspaceId },
    subscription_data: {
      metadata: { workspaceId: context.workspaceId },
    },
  });

  return NextResponse.json({ url: session.url });
}
