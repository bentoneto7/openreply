import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleCheck,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Comentou — sistema comercial do Instagram",
  description:
    "Transforme intenção no Instagram em oportunidades organizadas, atendimento orientado e vendas acompanháveis.",
};

const steps = [
  {
    number: "01",
    title: "Encontre a intenção",
    description:
      "Defina os comentários que indicam interesse na sua oferta, como PREÇO, QUERO ou LINK.",
  },
  {
    number: "02",
    title: "Inicie a conversa",
    description:
      "A primeira mensagem chega pelo Direct com a experiência que você revisou antes de ativar.",
  },
  {
    number: "03",
    title: "Conduza até o resultado",
    description:
      "Sua equipe prioriza, acompanha a oportunidade e registra o desfecho comercial com contexto.",
  },
];

const benefits = [
  "Fila comercial por prioridade",
  "Origem de cada oportunidade",
  "Histórico do contato",
  "Responsável e próxima ação",
  "Links rastreados",
  "Resultados registrados pela equipe",
];

const faqs = [
  {
    question: "A Comentou envia mensagens sem minha revisão?",
    answer:
      "Não. Você configura e revisa a jornada antes da ativação. Respostas humanas e sugestões comerciais continuam sob seu controle.",
  },
  {
    question: "Preciso informar a senha do Instagram?",
    answer:
      "Não. A conexão é feita pelo fluxo oficial da Meta. A Comentou não solicita nem armazena sua senha do Instagram.",
  },
  {
    question: "Um clique conta como venda?",
    answer:
      "Não. Cliques são sinais de interesse. Uma venda só aparece como resultado depois de ser registrada e confirmada pela sua equipe.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Comentou — início">
            <BrandLogo className="h-auto w-36" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex items-center justify-center rounded bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-hover"
            >
              Começar agora
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-blue-700 text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:px-8 lg:py-24">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-blue-100">
              Sistema comercial do Instagram
            </p>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-black leading-[1.04] sm:text-5xl lg:text-6xl">
              Comentou transforma intenção no Instagram em vendas acompanháveis.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-50">
              Encontre quem demonstrou interesse, inicie o Direct no momento certo e dê à sua equipe o contexto para conduzir cada oportunidade.
            </p>
            <p className="mt-5 text-lg font-extrabold text-white">
              O comentário chegou. A oportunidade não espera.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cadastro"
                className="inline-flex items-center justify-center gap-2 rounded bg-white px-6 py-3.5 text-sm font-extrabold text-blue-700 transition hover:bg-blue-50"
              >
                Criar minha primeira campanha
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center rounded border border-blue-300 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-blue-600"
              >
                Ver a jornada
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-blue-50">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> API oficial da Meta
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleCheck className="h-4 w-4" aria-hidden="true" /> Sem senha do Instagram
              </span>
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4" aria-hidden="true" /> Controle humano
              </span>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-blue-400 bg-white p-5 text-zinc-950 shadow-2xl shadow-blue-950/20 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <p className="text-sm font-extrabold">Jornada de uma oportunidade</p>
                <p className="mt-1 text-xs text-zinc-500">Exemplo ilustrativo</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                Em acompanhamento
              </span>
            </div>
            <ol className="mt-5 space-y-3">
              <li className="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-extrabold">Maria comentou “PREÇO”</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">Intenção de preço identificada na publicação da oferta.</p>
                </div>
              </li>
              <li className="ml-5 border-l-2 border-blue-200 pl-5">
                <p className="text-sm font-extrabold">Direct iniciado</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">A mensagem revisada é enviada e a origem acompanha o contato.</p>
              </li>
              <li className="ml-5 border-l-2 border-blue-200 pl-5">
                <p className="text-sm font-extrabold">Oportunidade na fila</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">A equipe recebe contexto, prioridade e próxima ação sugerida.</p>
              </li>
              <li className="ml-5 border-l-2 border-blue-200 pl-5">
                <p className="text-sm font-extrabold">Resultado registrado</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">Ganho ou perda só entra no relatório após confirmação humana.</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-zinc-200 bg-zinc-50 py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-accent">Do comentário ao resultado</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            Sua equipe entra com contexto, não com adivinhação.
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {steps.map((step) => (
              <article key={step.number} className="rounded-xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-black text-accent">{step.number}</p>
                <h3 className="mt-5 text-xl font-extrabold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-accent">Antes e depois</p>
          <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">O Direct deixa de ser uma caixa-preta.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-sm font-extrabold text-zinc-500">Antes</p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">Comentários se perdem, atendimentos atrasam e ninguém sabe de onde veio a venda.</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-extrabold text-blue-700">Com a Comentou</p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">Cada contato chega com origem, etapa, responsável, próxima ação e desfecho registrável.</p>
            </div>
          </div>
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm font-semibold">
              <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {benefit}
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="border-y border-zinc-200 bg-zinc-50 py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-accent">Perguntas frequentes</p>
            <h2 className="mt-3 text-4xl font-black leading-tight">Clareza antes de conectar.</h2>
          </div>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200">
            {faqs.map((faq) => (
              <article key={faq.question} className="py-6">
                <h3 className="font-extrabold">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-2xl border border-blue-200 bg-blue-50 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-accent">Comentou completo</p>
            <h2 className="mt-2 text-4xl font-black">R$ 87 por mês</h2>
            <p className="mt-3 max-w-2xl text-zinc-600">Leads e campanhas ilimitados no plano, com toda a operação comercial em um só lugar.</p>
          </div>
          <Link
            href="/cadastro"
            className="inline-flex items-center justify-center rounded bg-accent px-7 py-4 text-sm font-extrabold text-white transition hover:bg-accent-hover"
          >
            Começar agora
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-5 text-zinc-500">
          A Comentou automatiza a identificação e o primeiro contato com pessoas que interagem no Instagram. Resultados variam conforme oferta, conteúdo, atendimento e mercado. Não garantimos faturamento. “Ilimitado” significa que a Comentou não aplica limite contratual; limites técnicos e políticas da Meta continuam válidos.
        </p>
      </section>

      <footer className="border-t border-zinc-200 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-zinc-500 sm:flex-row sm:px-6 lg:px-8">
          <BrandLogo className="h-auto w-28" />
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-zinc-950">Privacidade</Link>
            <Link href="/terms" className="hover:text-zinc-950">Termos de uso</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
