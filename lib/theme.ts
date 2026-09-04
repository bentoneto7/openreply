/**
 * Tema claro/escuro da plataforma.
 *
 * Uma definição só, compartilhada pelo script inline do layout (que roda antes
 * da primeira pintura) e pelo botão que alterna. Se as duas lerem regras
 * diferentes, o usuário vê a tela piscar no tema errado antes de corrigir.
 */

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

/** Chave no localStorage. Ausente = seguir a preferência do sistema. */
export const THEME_STORAGE_KEY = "comentou-theme";

/** Atributo lido pelo CSS em `app/globals.css`. */
export const THEME_ATTRIBUTE = "data-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Script executado de forma síncrona durante o parse do HTML, antes de
 * qualquer pintura — é o que evita o flash de tela branca em quem escolheu o
 * escuro. Precisa ser ES5 e autônomo: roda antes de qualquer bundle.
 *
 * Sem escolha salva, segue `prefers-color-scheme`. O try/catch cobre o
 * localStorage indisponível (janela anônima, cookies bloqueados), caso em que
 * o tema claro do atributo padrão prevalece.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE
)},t)}catch(e){}})()`;

/**
 * Tema efetivo agora, lendo as mesmas fontes que o script inline, na mesma
 * ordem. Usado pelo inicializador preguiçoso do botão para que o estado do
 * React já nasça igual ao DOM que o script montou.
 */
export function resolveTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // localStorage indisponível: cai para a preferência do sistema.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Aplica no DOM e persiste. Persistir falha em silêncio: trocar de tema não
 *  pode quebrar por causa de armazenamento bloqueado. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sem persistência a escolha vale só nesta aba, o que é melhor que travar.
  }
}
