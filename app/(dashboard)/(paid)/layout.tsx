import { redirect } from "next/navigation";
import { hasPaidAccess } from "@/lib/billing/subscription";
import { isBillingEnforcementEnabled } from "@/lib/env";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

/**
 * Paywall for the tool itself.
 *
 * Creating an account and connecting Instagram stay open — those live outside
 * this group, under /settings and /billing. Everything that actually operates
 * the product sits inside it, so a single guard covers every current page and
 * anything added here later.
 */
export default async function PaidLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/login");
  }

  if (
    isBillingEnforcementEnabled() &&
    !hasPaidAccess(context.workspace.subscriptionStatus)
  ) {
    redirect("/billing?locked=1");
  }

  return <>{children}</>;
}
