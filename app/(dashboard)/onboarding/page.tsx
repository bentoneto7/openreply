import OnboardingReadiness from "@/components/onboarding-readiness";

export const metadata = {
  title: "Primeiro resultado - Comentou",
  description: "Confira a integração e prepare sua primeira campanha com segurança.",
};

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Primeiro resultado
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Da conexão à primeira campanha, sem adivinhar estados
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
          Veja o que o Comentou confirmou, o que está indisponível e o que ainda
          depende da Meta antes de preparar sua automação.
        </p>
      </header>
      <OnboardingReadiness />
    </div>
  );
}
