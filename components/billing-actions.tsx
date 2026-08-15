"use client";

import { useState } from "react";

export function BillingActions({ hasCustomer }: { hasCustomer: boolean }) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(path: string, action: "checkout" | "portal") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Não foi possível abrir a Stripe");
      }
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => open("/api/billing/checkout", "checkout")}
          disabled={busy !== null}
          className="rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy === "checkout" ? "Abrindo checkout..." : "Assinar por R$ 87/mês"}
        </button>
        {hasCustomer && (
          <button
            type="button"
            onClick={() => open("/api/billing/portal", "portal")}
            disabled={busy !== null}
            className="rounded border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            {busy === "portal" ? "Abrindo portal..." : "Gerenciar cobrança"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
