"use client";

/**
 * Sidebar Navigation
 *
 * Text-only nav with active state and workspace section.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import {
  BarChart3,
  Bot,
  CreditCard,
  Flame,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  Settings,
  Stethoscope,
} from "lucide-react";

const navItems = [
  { label: "Central de vendas", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mapa de Calor", href: "/heatmap", icon: Flame },
  { label: "Resultados", href: "/overview", icon: BarChart3 },
  { label: "Oportunidades", href: "/inbox", icon: HeartHandshake },
  { label: "Automações", href: "/campaigns", icon: Bot },
  { label: "Atividade", href: "/logs", icon: ListChecks },
  { label: "Assinatura", href: "/billing", icon: CreditCard },
  { label: "Configurações", href: "/settings", icon: Settings },
  { label: "Diagnóstico", href: "/diagnostics", icon: Stethoscope },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="px-6 py-5 border-b border-border">
          <Link href="/dashboard" aria-label="Comentou — painel">
            <BrandLogo className="h-auto w-36" priority />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-sm text-foreground truncate">{workspaceName}</p>
          <p className="text-xs text-muted">Comentários que viram conversas</p>
        </div>
      </aside>
    </>
  );
}
