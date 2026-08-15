import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenReply - Automação de comentários para DM no Instagram",
  description:
    "Uma alternativa gratuita ao ManyChat com hospedagem própria. Envie uma DM no Instagram quando alguém comentar uma palavra-chave no seu post ou reel, usando a API oficial da Meta.",
  keywords: [
    "instagram automation",
    "comment to DM",
    "instagram private replies",
    "social commerce",
    "manychat alternative",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full dark">
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
