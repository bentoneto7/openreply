import type { Metadata } from "next";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Comentou — Comentários que viram conversas de venda",
  description: "Transforme comentários com intenção de compra em conversas no Direct. Leads ilimitados por R$ 87 por mês.",
};

const steps = [
  ["01", "Identifique a intenção", "Escolha palavras como PREÇO, QUERO ou LINK para reconhecer comentários com interesse na sua oferta."],
  ["02", "Responda no momento certo", "A Comentou envia a primeira mensagem no Direct pela API oficial da Meta e abre caminho para sua abordagem."],
  ["03", "Acompanhe cada oportunidade", "Veja contatos, mensagens entregues e cliques para priorizar as conversas com maior potencial de venda."],
];

const benefits = [
  "Leads ilimitados no plano",
  "Automações e campanhas ilimitadas",
  "Palavras-chave de intenção de compra",
  "Respostas automáticas no Direct",
  "Links rastreados com métricas de clique",
  "Painel de comentários e sinais comerciais",
];

const funnel = [
  ["Comentários com intenção", "1.284"],
  ["DMs entregues", "1.196"],
  ["Cliques no link", "356"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Comentou — início"><BrandLogo className="h-auto w-36" priority /></Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-semibold text-zinc-600 hover:text-zinc-900 sm:block">Entrar</Link>
            <Link href="/login" className="rounded bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-hover">Começar agora</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
        <div>
          <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-bold text-accent">Leads ilimitados por R$ 87/mês</div>
          <h1 className="mt-6 text-balance text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">Comentários que viram conversas de venda</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">Identifique comentários com intenção, envie a primeira mensagem no Direct e concentre sua equipe nas oportunidades que merecem uma abordagem 1:1.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="rounded bg-accent px-6 py-3.5 text-center text-sm font-bold text-white transition hover:bg-accent-hover">Começar por R$ 87/mês</Link>
            <a href="#como-funciona" className="rounded border border-zinc-300 bg-white px-6 py-3.5 text-center text-sm font-bold hover:bg-zinc-50">Ver como funciona</a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Plano único · Cancele quando quiser · API oficial da Meta</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-xl shadow-blue-950/10 sm:p-7">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
            <div><p className="text-sm font-bold">Funil de oportunidades</p><p className="mt-1 text-xs text-zinc-500">Este mês</p></div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">Em crescimento</span>
          </div>
          <div className="mt-5 space-y-3">
            {funnel.map(([label, value], index) => (
              <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-end justify-between gap-4"><p className="text-sm font-semibold text-zinc-600">{label}</p><p className="text-2xl font-black">{value}</p></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-accent" style={{ width: `${100 - index * 24}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Dados ilustrativos. Vendas dependem da oferta e da abordagem comercial.</p>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-zinc-200 bg-zinc-50 py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-wider text-accent">Do comentário à conversa</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">Sua equipe entra quando a intenção de compra aparece</h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {steps.map(([number, title, description]) => (
              <article key={number} className="rounded-xl border border-zinc-200 bg-white p-6"><p className="text-sm font-black text-accent">{number}</p><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div><p className="text-sm font-bold uppercase tracking-wider text-accent">Tudo em um plano</p><h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Mais conversas. Sem contar leads.</h2><p className="mt-5 text-base leading-8 text-zinc-600">Uma estrutura simples para captar interesse no Instagram e transformar sinais de intenção em oportunidades de atendimento.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">{benefits.map((benefit) => <div key={benefit} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm font-semibold"><Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{benefit}</div>)}</div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-2xl bg-blue-50 p-7 ring-1 ring-blue-200 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><p className="text-sm font-bold text-accent">COMENTOU COMPLETO</p><h2 className="mt-2 text-4xl font-black">R$ 87 por mês</h2><p className="mt-3 text-zinc-600">Leads e automações ilimitados. Todos os recursos incluídos.</p></div>
          <Link href="/login" className="rounded bg-accent px-7 py-4 text-center text-sm font-bold text-white transition hover:bg-accent-hover">Ativar a Comentou</Link>
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-5 text-zinc-500">A Comentou automatiza a identificação e o primeiro contato com pessoas que interagem no Instagram. Resultados variam conforme oferta, conteúdo, atendimento e mercado. Não garantimos faturamento. “Leads ilimitados” significa que a Comentou não aplica limite contratual de leads; limites técnicos e políticas da Meta continuam válidos.</p>
      </section>

      <footer className="border-t border-zinc-200 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-zinc-500 sm:flex-row sm:px-6 lg:px-8"><BrandLogo className="h-auto w-28" /><div className="flex gap-5"><Link href="/privacy">Privacidade</Link><Link href="/terms">Termos de uso</Link></div></div>
      </footer>
    </main>
  );
}
