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
  Lock,
  Settings,
  Stethoscope,
} from "lucide-react";

// `paid` mirrors the app/(dashboard)/(paid) route group. Items outside it stay
// reachable without a subscription so the account can be set up and paid for.
const navItems = [
  { label: "Central de vendas", href: "/dashboard", icon: LayoutDashboard, paid: true },
  { label: "Mapa de Calor", href: "/heatmap", icon: Flame, paid: true },
  { label: "Resultados", href: "/overview", icon: BarChart3, paid: true },
  { label: "Oportunidades", href: "/inbox", icon: HeartHandshake, paid: true },
  { label: "Automações", href: "/campaigns", icon: Bot, paid: true },
  { label: "Atividade", href: "/logs", icon: ListChecks, paid: true },
  { label: "Assinatura", href: "/billing", icon: CreditCard, paid: false },
  { label: "Configurações", href: "/settings", icon: Settings, paid: false },
  { label: "Diagnóstico", href: "/diagnostics", icon: Stethoscope, paid: true },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  subscriptionActive: boolean;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
  subscriptionActive,
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
            const isLocked = item.paid && !subscriptionActive;
            return (
              <Link
                key={item.href}
                href={isLocked ? "/billing?locked=1" : item.href}
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
                <span className="flex-1 truncate">{item.label}</span>
                {isLocked && (
                  <>
                    <Lock aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                    <span className="sr-only">(requer assinatura)</span>
                  </>
                )}
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
