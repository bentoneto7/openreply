import Link from "next/link";
import BrandLogo from "@/components/brand-logo";

interface PublicSiteHeaderProps {
  active?: "home" | "templates";
}

const navLinks = [
  { label: "Modelos", href: "/templates", key: "templates" },
  { label: "Agências", href: "/instagram-dm-automation-agencies", key: "agencies" },
  { label: "Preço", href: "/#pricing", key: "pricing" },
  { label: "Segurança", href: "/#security", key: "security" },
];

export default function PublicSiteHeader({ active }: PublicSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/85">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Comentou — início">
          <BrandLogo className="h-auto w-32" priority />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={`text-sm font-medium transition ${
                active === link.key ? "text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:text-white sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-blue-300 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-blue-200"
          >
            Começar agora
          </Link>
        </div>
      </div>
    </header>
  );
}
