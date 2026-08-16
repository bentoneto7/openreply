import { redirect } from "next/navigation";
import { nextOnboardingStep } from "@/lib/billing/subscription";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

/**
 * O paywall do produto.
 *
 * Criar a conta, conectar o Instagram e assinar ficam fora deste grupo, em
 * /settings e /billing. Tudo que opera a ferramenta fica dentro, então uma
 * única guarda cobre todas as telas de hoje e as que forem criadas aqui depois.
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

  const instagramCount = await prisma.instagramAccount.count({
    where: { workspaceId: context.workspaceId },
  });

  const step = nextOnboardingStep({
    instagramConnected: instagramCount > 0,
    subscriptionStatus: context.workspace.subscriptionStatus,
  });

  if (step) {
    redirect(step);
  }

  return <>{children}</>;
}
