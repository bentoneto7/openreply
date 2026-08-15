import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
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
  if (!context.workspace.stripeCustomerId) {
    return NextResponse.json(
      { error: "Nenhum cliente Stripe associado" },
      { status: 400 }
    );
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: context.workspace.stripeCustomerId,
    return_url: `${getBaseUrl()}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
