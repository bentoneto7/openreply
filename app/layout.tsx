import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

// Display face for landing headlines. Plus Jakarta tops out at 800 and stays
// fairly wide, so it cannot carry the heavy, tight headline the landing needs.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
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
    <html lang="pt-BR" className="h-full">
      <body className={`${plusJakarta.variable} ${archivo.variable} min-h-full bg-background text-foreground font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
