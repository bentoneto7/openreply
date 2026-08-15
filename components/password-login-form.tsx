"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error ?? "Não foi possível entrar."); setBusy(false); return; }
    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/dashboard"); router.refresh();
  }
  return <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">E-mail<input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded border border-border bg-surface px-4 py-3" /></label><label className="block text-sm font-medium">Senha<input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded border border-border bg-surface px-4 py-3" /></label>{error && <p role="alert" className="text-sm text-error">{error}</p>}<button disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">{busy ? "Entrando..." : "Entrar com senha"}</button></form>;
}
