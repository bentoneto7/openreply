"use client";

/**
 * Top Bar
 *
 * Page title, mobile hamburger, and connection status.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, Plus, Sparkles } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Central de vendas",
  "/heatmap": "Mapa de Calor",
  "/overview": "Resultados",
  "/inbox": "Oportunidades",
  "/campaigns": "Automações",
  "/campaigns/new": "Nova automação de vendas",
  "/automations": "Automações",
  "/automations/new": "Nova automação de vendas",
  "/logs": "Atividade",
  "/billing": "Assinatura",
  "/settings": "Configurações",
  "/diagnostics": "Diagnóstico",
};

interface TopBarProps {
  onMenuClick: () => void;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  onMenuClick,
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Comentou";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 h-16 px-4 lg:px-8 border-b border-border bg-background">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
          aria-label="Abrir ou fechar menu lateral"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
      </div>

      {instagramAccountCount > 0 ? (
        <div className="flex items-center gap-3">
          <p className="hidden shrink-0 truncate text-sm text-muted sm:block">
            {instagramAccountCount > 1 ? `${instagramAccountCount} contas` : `@${instagramUsername}`}
          </p>
          <Link href="/campaigns/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Nova automação</span>
            <span className="sm:hidden">Criar</span>
          </Link>
        </div>
      ) : (
        <a
          href="/api/instagram/connect"
          className="shrink-0 whitespace-nowrap text-sm font-medium px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover"
        >
          {/* Full label needs more room than a 360px header has to spare. */}
          <Sparkles className="mr-2 inline h-4 w-4" aria-hidden="true" />
          <span className="sm:hidden">Conectar</span>
          <span className="hidden sm:inline">Conectar Instagram</span>
        </a>
      )}
    </header>
  );
}
