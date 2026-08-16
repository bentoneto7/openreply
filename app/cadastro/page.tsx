"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/brand-logo";

export default function CadastroPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error ?? "Não foi possível criar sua conta."); setBusy(false); return; }
    // Straight to billing: the account and the Instagram connection are free,
    // the tool itself only unlocks with an active subscription.
    router.push("/billing"); router.refresh();
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-10"><div className="w-full max-w-md"><div className="mb-7 text-center"><BrandLogo className="mx-auto h-auto w-40" priority /><h1 className="mt-6 text-2xl font-bold">Crie sua conta</h1><p className="mt-2 text-sm text-muted">Comece com nome, e-mail e senha. Nenhum link por e-mail é necessário.</p></div><form onSubmit={submit} className="panel space-y-5 rounded p-6 sm:p-8"><label className="block text-sm font-medium">Nome<input name="name" autoComplete="name" required minLength={2} className="mt-2 w-full rounded border border-border bg-surface px-4 py-3" placeholder="Seu nome" /></label><label className="block text-sm font-medium">E-mail<input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded border border-border bg-surface px-4 py-3" placeholder="voce@empresa.com" /></label><label className="block text-sm font-medium">Senha<input name="password" type="password" autoComplete="new-password" required minLength={8} className="mt-2 w-full rounded border border-border bg-surface px-4 py-3" placeholder="Mínimo de 8 caracteres" /><span className="mt-2 block text-xs font-normal text-muted">Use pelo menos uma letra e um número.</span></label>{error && <p role="alert" className="text-sm text-error">{error}</p>}<button disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">{busy ? "Criando conta..." : "Criar conta e entrar"}</button><p className="text-center text-sm text-muted">Já possui uma conta? <Link href="/login" className="font-semibold text-accent hover:underline">Entrar</Link></p></form></div></main>;
}
