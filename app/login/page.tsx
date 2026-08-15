import { signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";
import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import PasswordLoginForm from "@/components/password-login-form";

export const metadata = {
  title: "Entrar - Comentou",
  description: "Entre para acompanhar comentários com intenção e oportunidades de venda.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkEmail?: string;
    callbackUrl?: string;
    template?: string;
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: String(formData.get("email") ?? ""),
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo className="mx-auto h-auto w-40" priority />
          <p className="text-muted text-sm leading-relaxed mt-2">
            {selectedTemplate
              ? `Entre para usar o modelo ${selectedTemplate.title}.`
              : "Entre para transformar comentários com intenção em conversas de venda."}
          </p>
        </div>

        <div className="panel rounded p-8 shadow-black/40">
          {selectedTemplate && !checkEmail && (
            <div className="mb-5 border border-accent/20 bg-accent/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Modelo selecionado
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {selectedTemplate.title}
              </p>
            </div>
          )}

          {checkEmail ? (
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold mb-2">Verifique seu e-mail</h2>
              <p className="text-sm text-muted">
                Enviamos um link seguro de acesso. Abra-o neste dispositivo para
                continuar.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <PasswordLoginForm callbackUrl={callbackUrl} />
              <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" /><span>ou use o link por e-mail</span><span className="h-px flex-1 bg-border" /></div>
            <form action={sendMagicLink} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  E-mail profissional
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="voce@empresa.com"
                  className="w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-indigo-500/25 transition-all hover:shadow-indigo-500/30"
              >
                Receber link de acesso
              </button>
            </form>
            </div>
          )}
          {!checkEmail && <p className="mt-5 text-center text-sm text-muted">Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-accent hover:underline">Cadastre-se com senha</Link></p>}
        </div>
      </div>
    </div>
  );
}
