import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { hasPaidAccess } from "@/lib/billing/subscription";

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { workspace } = context;
  return NextResponse.json({
    success: true,
    data: {
      status: workspace.subscriptionStatus,
      active: hasPaidAccess(workspace.subscriptionStatus),
      periodEnd: workspace.subscriptionPeriodEnd,
      cancelAtPeriodEnd: workspace.cancelAtPeriodEnd,
      canManage: canManage(context.role),
      hasCustomer: Boolean(workspace.stripeCustomerId),
    },
  });
}

function canManage(role: string) {
  return role === "OWNER";
}
