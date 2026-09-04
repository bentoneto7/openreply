import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "Comentou — Comentários que viram conversas",
  description:
    "Transforme comentários com intenção em conversas individuais e oportunidades de venda pelo Instagram.",
  keywords: [
    "instagram automation",
    "comment to DM",
    "instagram private replies",
    "social commerce",
    "manychat alternative",
    "Comentou",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme padrão + suppressHydrationWarning: o script abaixo troca o
    // atributo antes da hidratação, e o React tem que aceitar o DOM em vez de
    // reverter para o que veio do servidor.
    <html lang="pt-BR" className="h-full" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Roda de forma síncrona no parse, antes da primeira pintura: sem ele
            quem escolheu o escuro vê um lampejo branco a cada carga. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${plusJakarta.variable} min-h-full bg-background text-foreground font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
