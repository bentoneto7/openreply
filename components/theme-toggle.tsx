"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, resolveTheme, THEME_ATTRIBUTE, type Theme } from "@/lib/theme";

/**
 * Alterna entre o tema claro e o escuro.
 *
 * Sem estado do React de propósito. Qual ícone aparece é decidido pelo CSS a
 * partir do `data-theme` no <html>, não por um `useState`: o servidor não sabe
 * a preferência de quem vai receber a página, então um estado inicializado no
 * cliente renderizaria um ícone diferente do que veio no HTML e quebraria a
 * hidratação. O atributo já está correto antes da primeira pintura, graças ao
 * script inline do layout, e o CSS simplesmente segue.
 *
 * O efeito colateral bom: alternar não re-renderiza nada. Trocar o atributo do
 * <html> repinta a interface inteira, este botão incluído.
 */
export default function ThemeToggle() {
  // Em desenvolvimento o Strict Mode remonta uma vez e, nessa remontagem, o
  // React zera os atributos de <html> que não vêm do JSX — inclusive o que o
  // script inline gravou. Reaplicar aqui devolve o tema antes da pintura. Em
  // produção é um no-op. Ver o guia "preventing flash before hydration" do Next.
  useLayoutEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, resolveTheme());
  }, []);

  function toggle() {
    // O DOM é a fonte da verdade do que está na tela agora: ler dele evita
    // divergir do que o script inline decidiu na carga.
    const current: Theme =
      document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Rótulo estático, e por isso mesmo idêntico no servidor e no cliente.
      // Descreve a ação, que é a mesma nos dois temas; a direção quem mostra é
      // o ícone.
      aria-label="Alternar entre tema claro e escuro"
      title="Alternar tema"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-border-hover hover:text-foreground"
    >
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}
