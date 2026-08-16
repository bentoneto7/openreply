import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  Flame,
  Layers,
  ListChecks,
  Lock,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Comentou — Saiba quem abordar agora no Instagram",
  description:
    "A Comentou lê as interações públicas do seu Instagram pela API oficial da Meta, mede intenção comercial e mostra quem abordar agora, sobre qual assunto e antes de esfriar.",
  openGraph: {
    title: "Comentou — Saiba quem abordar agora no Instagram",
    description:
      "Mapa de calor de intenção comercial no Instagram. Cada ponto nasce de um evento verificável, pela API oficial da Meta.",
    locale: "pt_BR",
    type: "website",
  },
};

const DISPLAY =
  "font-display font-black leading-[0.98] tracking-[-0.03em] text-[clamp(2.5rem,6vw,4.75rem)] text-white";
const H2 =
  "font-display font-black leading-[1.02] tracking-[-0.025em] text-[clamp(1.9rem,3.8vw,3rem)] text-white";
const H3 = "text-lg font-bold leading-[1.3] tracking-[-0.012em] text-white sm:text-xl";
const LEAD = "text-pretty text-base leading-[1.65] text-white/60 sm:text-lg";
const BODY = "text-sm leading-6 text-white/55";
const EYEBROW = "font-mono text-[0.6875rem] uppercase tracking-[0.18em]";

const CONTAINER = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const SECTION = "py-20 sm:py-24 lg:py-28";

const CTA =
  "cta-gradient inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white transition-all duration-150";
const CTA_GHOST =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white/85 transition-colors duration-150 hover:border-white/30 hover:bg-white/10 hover:text-white";

/** Divider badge, echoed between sections the way a section marker works. */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/70 ${EYEBROW}`}
    >
      {children}
    </span>
  );
}

const trustChips = [
  { icon: ShieldCheck, label: "API oficial da Meta" },
  { icon: Lock, label: "Nunca pedimos sua senha" },
  { icon: ScrollText, label: "Histórico auditável" },
];

const automatic = [
  {
    title: "Reconhece o comentário com intenção",
    body: "Palavras comerciais, pedido de preço, pergunta sobre a oferta.",
  },
  {
    title: "Abre a conversa no Direct",
    body: "Mensagem enviada pela API oficial da Meta, com o link quando fizer sentido.",
  },
  {
    title: "Registra o clique no link rastreado",
    body: "Ligado ao conteúdo que originou a interação, como sinal — não como venda.",
  },
  {
    title: "Pontua e ordena a fila",
    body: "O lead entra no mapa de calor com nota, temperatura e motivo.",
  },
];

const beforeAfter = {
  before: [
    "A caixa de entrada chega em ordem cronológica, sem peso e sem contexto.",
    "Quem perguntou preço na terça é atendido na quinta, quando a intenção já passou.",
    "Ninguém sabe dizer por que aquele lead foi priorizado — foi intuição.",
    "Mensagem de robô e abordagem de gente se misturam no mesmo número.",
  ],
  after: [
    "A fila chega ordenada por intenção medida e recência, não por horário.",
    "Quem esquentou hoje aparece no topo, com a janela de tempo à vista.",
    "Cada posição vem com o detalhamento de pontos que a colocou ali.",
    "Automático e humano ficam em trilhas separadas no histórico do lead.",
  ],
};

const temperatures = [
  {
    label: "Quentes agora",
    icon: Flame,
    chip: "border-red-400/25 bg-red-400/10 text-red-300",
    body: "Interesse comercial recente, ainda dentro da janela em que abordar faz sentido. É deste grupo que sai a fila de hoje.",
  },
  {
    label: "Aquecendo",
    icon: TrendingUp,
    chip: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    body: "Aumentaram a frequência das interações. Ainda não pediram nada, mas a curva sobe. Momento de conteúdo, não de oferta.",
  },
  {
    label: "Esfriando",
    icon: TrendingDown,
    chip: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    body: "Tiveram intenção alta e pararam. O decaimento derruba a nota dia após dia: é uma janela fechando, não uma lista morta.",
  },
  {
    label: "Reativados",
    icon: RotateCcw,
    chip: "border-green-400/25 bg-green-400/10 text-green-300",
    body: "Estavam frios e voltaram. Reaparecer depois do silêncio é um sinal diferente de um contato novo, e é tratado como tal.",
  },
];

const breakdown = [
  { pts: 12, label: "Pediu preço hoje", meta: "Comentário · há 2h", positive: true },
  { pts: 9, label: "Clicou no link rastreado 2×", meta: "Link rastreado · ontem", positive: true },
  { pts: 6, label: "Respondeu 3 Stories na semana", meta: "Story · há 4 dias", positive: true },
  { pts: 2, label: "Interações perderam força", meta: "vs. semana anterior", positive: false },
];

const audience = [
  {
    tag: "Infoprodutores",
    body: "Lançamento gera comentário em massa. A fila separa quem perguntou preço de quem só reagiu.",
    src: "/landing/lead-third.jpg",
    alt: "Pessoa de moletom escuro olhando o celular em um estúdio com luz violeta",
    pos: "object-center",
  },
  {
    tag: "Social sellers e criadores",
    body: "Você atende sozinho. O mapa decide por onde começar quando o dia não cabe na caixa de entrada.",
    src: "/landing/lead-wide.jpg",
    alt: "Pessoa em ambiente escuro com luz azul, concentrada em uma tela",
    pos: "object-center",
  },
  {
    tag: "Agências e times comerciais",
    body: "Várias contas, vários responsáveis. Cada abordagem humana fica registrada com nome e horário.",
    src: "/landing/lead-portrait.jpg",
    alt: "Pessoa olhando para baixo em uma sala escura com luz violeta no teto",
    pos: "object-center",
  },
];

const steps = [
  {
    number: "01",
    title: "Crie sua conta",
    body: "Cadastro por e-mail. Nenhum dado do Instagram é solicitado nesta etapa.",
  },
  {
    number: "02",
    title: "Conecte o Instagram",
    body: "Autorização pelo login oficial da Meta, com as permissões na tela antes de você aceitar. Nunca pedimos sua senha.",
  },
  {
    number: "03",
    title: "Defina o que é sinal comercial",
    body: "Escolha quais eventos indicam intenção e o peso de cada um. Comece pelo padrão e ajuste — as regras são versionadas.",
  },
  {
    number: "04",
    title: "Trabalhe a fila",
    body: "Assim que os eventos chegam, o mapa de calor se forma e a fila “quem abordar agora” passa a ser preenchida.",
  },
];

const limits = [
  "Não garante venda, faturamento nem taxa de conversão. Resultado depende da sua oferta, do seu conteúdo, do seu preço e da abordagem do seu time.",
  "Não inventa dado que a Meta não entrega. Curtidas individuais e visualizações por pessoa não são estimadas nem preenchidas por aproximação.",
  "Não usa scraping nem automação de navegador. Toda captura passa pela API oficial da Meta.",
  "Não pede a senha do seu Instagram. Nunca, em nenhuma etapa.",
  "Não substitui seu time comercial. A plataforma organiza a decisão e abre a conversa. Quem vende é gente.",
  "Não conta clique como receita. Venda só existe com confirmação manual ou vinda do CRM ou checkout.",
];

const faq = [
  {
    q: "Preciso ter conta profissional no Instagram?",
    a: "Sim. A conta precisa ser Comercial ou Criador. A API oficial da Meta só entrega eventos de comentários, menções e mensagens para contas profissionais — em conta pessoal esses dados simplesmente não são disponibilizados a nenhuma ferramenta, incluindo a Comentou. A conversão de pessoal para profissional é feita dentro do próprio aplicativo do Instagram, é gratuita e reversível.",
  },
  {
    q: "Isso fere as regras da Meta? Vocês pedem minha senha?",
    a: "Não e não. A Comentou opera pela API oficial da Meta, com autorização concedida por você no fluxo de login oficial. Não há scraping, não há robô controlando um navegador logado na sua conta e em nenhum momento pedimos sua senha do Instagram. Essa é justamente a diferença entre uma integração autorizada e as ferramentas que colocam a sua conta em risco de restrição.",
  },
  {
    q: "O que acontece se eu criar a conta e não conectar o Instagram?",
    a: "Sua conta continua existindo normalmente, mas o mapa de calor fica vazio. Sem a conexão, não há eventos para capturar: nada de comentários, respostas de Story, menções, mensagens ou cliques. Nenhum dado histórico anterior à conexão é recuperado — a Meta não fornece o passado, só os eventos a partir da autorização.",
  },
  {
    q: "A Comentou responde no lugar do meu time? Eu perco o controle da conversa?",
    a: "Você configura se quer resposta automática e em quais situações. Mesmo com a automação ligada, mensagem automática e abordagem humana são registradas em trilhas separadas no histórico do lead: dá para ver exatamente o que o sistema enviou, quando, por qual regra, e o que uma pessoa do seu time enviou depois. Se preferir, use a plataforma apenas como painel de priorização, sem nenhum envio automático.",
  },
  {
    q: "Como o sistema sabe que uma venda aconteceu?",
    a: "Ele não sabe sozinho, e não finge que sabe. Clique em link rastreado é um sinal de intenção, não uma venda. Uma oportunidade só vira venda no sistema por confirmação manual de alguém do seu time ou por informação vinda do seu CRM ou checkout. Isso mantém os números do painel comparáveis com o que você realmente faturou, em vez de produzir um relatório otimista que ninguém consegue conciliar no fim do mês.",
  },
];

function HeatmapMockup() {
  return (
    <figure className="card-night overflow-hidden rounded-3xl p-4 shadow-[0_40px_120px_-40px_rgb(124_58_237/0.5)] sm:p-7">
      <figcaption className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hm-title" className={H3}>
          Mapa de Calor · últimos 7 dias
        </h2>
        <span className={`${EYEBROW} text-white/40`}>Exemplo de interface</span>
      </figcaption>

      <svg
        viewBox="0 0 640 440"
        role="img"
        aria-labelledby="hm-title hm-desc"
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <desc id="hm-desc">
          Dispersão de oito pessoas por intenção comercial no eixo horizontal e
          tendência de interação no eixo vertical. Duas estão no quadrante
          Abordar agora, com temperatura Quente.
        </desc>

        <rect x="340" y="28" width="268" height="164" fill="rgb(255 255 255 / 0.04)" />
        <rect
          x="340"
          y="28"
          width="268"
          height="164"
          fill="none"
          stroke="rgb(255 255 255 / 0.22)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <g stroke="rgb(255 255 255 / 0.08)" strokeWidth="1">
          <line x1="72" y1="110" x2="608" y2="110" />
          <line x1="72" y1="274" x2="608" y2="274" />
          <line x1="206" y1="28" x2="206" y2="356" />
          <line x1="474" y1="28" x2="474" y2="356" />
        </g>

        <line x1="72" y1="356" x2="608" y2="356" stroke="rgb(255 255 255 / 0.25)" strokeWidth="1.5" />
        <line x1="72" y1="28" x2="72" y2="356" stroke="rgb(255 255 255 / 0.25)" strokeWidth="1.5" />
        <line x1="340" y1="28" x2="340" y2="356" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1" strokeDasharray="5 5" />
        <line x1="72" y1="192" x2="608" y2="192" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1" strokeDasharray="5 5" />

        <g fill="rgb(255 255 255 / 0.45)" fontSize="11" fontWeight="600" letterSpacing="0.08em">
          <text x="596" y="48" textAnchor="end">ABORDAR AGORA</text>
          <text x="84" y="48">NUTRIR</text>
          <text x="596" y="344" textAnchor="end">RESGATAR</text>
          <text x="84" y="344">OBSERVAR</text>
        </g>

        {/* A forma carrega o estado; a cor apenas reforça. */}
        <g stroke="#06060f" strokeWidth="2">
          <circle cx="544" cy="80" r="7" fill="#f87171" />
          <circle cx="479" cy="123" r="7" fill="#f87171" />
          <polygon points="415,145 422,158 408,158" fill="#fbbf24" />
          <polygon points="351,164 358,177 344,177" fill="#fbbf24" />
          <polygon points="300,132 308,140 300,148 292,140" fill="#4ade80" />
          <rect x="286" y="186" width="12" height="12" rx="2" fill="#94a3b8" />
          <polygon points="249,246 256,233 242,233" fill="#a78bfa" />
          <polygon points="190,292 197,279 183,279" fill="#a78bfa" />
        </g>

        {/* Rótulos diretos: no mobile não cabem, e a tabela sr-only assume. */}
        <g
          className="hidden sm:block"
          fill="rgb(255 255 255 / 0.72)"
          fontSize="11"
          fontWeight="500"
          dominantBaseline="middle"
        >
          <text x="530" y="80" textAnchor="end">@ana.studio</text>
          <text x="465" y="123" textAnchor="end">@lucas.fit</text>
          <text x="429" y="152">@mari.decor</text>
          <text x="365" y="171">@pedro.tech</text>
          <text x="316" y="140">@clinicaviva</text>
          <text x="306" y="192">@juliaviaja</text>
          <text x="263" y="238">@studio.bela</text>
          <text x="204" y="284">@rafa.coach</text>
        </g>

        <text x="340" y="398" textAnchor="middle" fill="rgb(255 255 255 / 0.55)" fontSize="12" fontWeight="600">
          Intenção comercial (0–100)
        </text>
        <text
          x="24"
          y="192"
          textAnchor="middle"
          fill="rgb(255 255 255 / 0.55)"
          fontSize="12"
          fontWeight="600"
          transform="rotate(-90 24 192)"
        >
          Tendência de interação (7 dias)
        </text>
        <g fill="rgb(255 255 255 / 0.45)" fontSize="11">
          <text x="72" y="374">baixa</text>
          <text x="608" y="374" textAnchor="end">alta</text>
          <text x="60" y="34" textAnchor="end">+50</text>
          <text x="60" y="196" textAnchor="end">0</text>
          <text x="60" y="356" textAnchor="end">−50</text>
        </g>
      </svg>

      {/* Legenda em HTML, não em SVG: acompanha o zoom de texto do navegador. */}
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-5">
        <li className="flex items-center gap-2 text-xs font-semibold text-hot">
          <Flame className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Quente · círculo
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-warming">
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Aquecendo · triângulo
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-steady">
          <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Estável · quadrado
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-cooling">
          <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Esfriando · triângulo invertido
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-revived">
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Reativado · losango
        </li>
      </ul>

      <table className="sr-only">
        <caption>Dados do Mapa de Calor</caption>
        <thead>
          <tr>
            <th>Pessoa</th>
            <th>Intenção</th>
            <th>Tendência</th>
            <th>Temperatura</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>@ana.studio</td><td>88</td><td>+34</td><td>Quente</td></tr>
          <tr><td>@lucas.fit</td><td>76</td><td>+21</td><td>Quente</td></tr>
          <tr><td>@clinicaviva</td><td>42</td><td>+16</td><td>Reativado</td></tr>
          <tr><td>@mari.decor</td><td>62</td><td>+14</td><td>Aquecendo</td></tr>
          <tr><td>@pedro.tech</td><td>50</td><td>+8</td><td>Aquecendo</td></tr>
          <tr><td>@juliaviaja</td><td>40</td><td>0</td><td>Estável</td></tr>
          <tr><td>@studio.bela</td><td>33</td><td>−16</td><td>Esfriando</td></tr>
          <tr><td>@rafa.coach</td><td>22</td><td>−30</td><td>Esfriando</td></tr>
        </tbody>
      </table>

      <p className="mt-4 text-xs leading-5 text-white/40">
        Dados ilustrativos. Priorização sugerida a partir de interações
        observadas — não é previsão de compra.
      </p>
    </figure>
  );
}

function LeadCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet/20 text-xs font-bold text-violet"
          >
            AS
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">@ana.studio</p>
            <p className="truncate text-xs text-white/45">Curso de fotografia</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-1 text-xs font-bold text-red-300">
          <Flame className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Quente
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-black leading-none tracking-[-0.03em] tabular-nums text-white">
            88
          </span>
          <span className="text-sm font-semibold text-white/45">/100</span>
          <span className="sr-only">de intenção comercial</span>
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-red-300">
          <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          <span className="tabular-nums">+34</span> pts em 7 dias
        </p>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full bg-hot" style={{ width: "88%" }} />
      </div>

      <div className="mt-4 rounded-xl bg-white/[0.04] p-3">
        <p className="text-sm leading-6 text-white/80">
          “Quanto custa a turma de março? Consigo parcelar?”
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Comentário no Reel “Bastidores”
          <span aria-hidden="true">·</span>
          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          há 2 horas
        </p>
      </div>
    </div>
  );
}

function ScoreBreakdown() {
  return (
    <ul className="space-y-2">
      {breakdown.map((row) => (
        <li
          key={row.label}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
        >
          <span
            className={`inline-flex min-w-[3.25rem] shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-1 text-xs font-black tabular-nums ${
              row.positive
                ? "bg-green-400/12 text-green-300"
                : "bg-white/10 text-white/60"
            }`}
          >
            {row.positive ? (
              <Plus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            ) : (
              <Minus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            )}
            {row.pts}
            <span className="sr-only">
              {row.positive ? "pontos somados" : "pontos subtraídos"}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-5 text-white/90">
              {row.label}
            </span>
            <span className="block text-xs text-white/45">{row.meta}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-night">
      <header className="sticky top-3 z-50 px-3 sm:top-5 sm:px-5">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between rounded-full border border-white/10 bg-night-2/80 pl-5 pr-2 backdrop-blur-xl sm:pl-7 sm:pr-3">
          <Link href="/" aria-label="Comentou — início" className="shrink-0">
            <BrandLogo className="h-auto w-28 brightness-0 invert sm:w-32" priority />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#mapa-de-calor"
              className={`hidden min-h-11 items-center rounded-full px-4 text-white/60 transition-colors duration-150 hover:text-white lg:inline-flex ${EYEBROW}`}
            >
              Como funciona
            </a>
            <Link
              href="/login"
              className={`hidden min-h-11 items-center rounded-full px-4 text-white/60 transition-colors duration-150 hover:text-white sm:inline-flex ${EYEBROW}`}
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className={`cta-gradient inline-flex min-h-11 items-center rounded-full px-5 font-bold text-white ${EYEBROW}`}
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative -mt-16 overflow-hidden pt-36 pb-20 sm:pt-44">
          <div className="dot-grid absolute inset-0" aria-hidden="true" />
          <div
            className="orb left-1/2 top-[-14rem] h-[34rem] w-[34rem] -translate-x-1/2 bg-violet/35"
            aria-hidden="true"
          />
          <div
            className="orb left-[-10rem] top-32 h-[26rem] w-[26rem] bg-sky/25"
            aria-hidden="true"
          />
          <div
            className="orb right-[-10rem] top-20 h-[26rem] w-[26rem] bg-violet/25"
            aria-hidden="true"
          />

          <div className={`${CONTAINER} relative text-center`}>
            <Badge>
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Inteligência de intenção para Instagram
            </Badge>
            <h1 className={`mx-auto mt-8 max-w-[18ch] ${DISPLAY}`}>
              Você sabe quem comentou. Não sabe quem abordar.
            </h1>
            <p className={`mx-auto mt-7 max-w-[62ch] ${LEAD}`}>
              A Comentou lê as interações públicas do seu Instagram pela API
              oficial da Meta, mede intenção comercial e monta um mapa de calor
              que responde quem abordar agora, por quê, sobre qual assunto e
              quanto tempo você tem antes do interesse esfriar.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/cadastro" className={CTA}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link href="/login" className={CTA_GHOST}>
                Já tenho conta
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {trustChips.map(({ icon: Icon, label }) => (
                <li key={label} className={`flex items-center gap-2 text-white/50 ${EYEBROW}`}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className={`${CONTAINER} relative mt-16`}>
            <HeatmapMockup />
          </div>
        </section>

        {/* Automaticamente */}
        <section className={`relative ${SECTION}`}>
          <div className={`${CONTAINER} text-center`}>
            <Badge>Automaticamente</Badge>
            <h2 className={`mx-auto mt-7 max-w-[22ch] ${H2}`}>
              O que roda sem você tocar
            </h2>
          </div>
          <div className={`${CONTAINER} mt-14`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {automatic.map(({ title, body }) => (
                <article key={title} className="card-night rounded-2xl p-6">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-green-400/12"
                  >
                    <Check className="h-4 w-4 text-green-300" strokeWidth={3} />
                  </span>
                  <h3 className="mt-5 text-base font-bold leading-snug text-white">{title}</h3>
                  <p className={`mt-2 ${BODY}`}>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Bento — o produto */}
        <section id="mapa-de-calor" className={`relative scroll-mt-24 ${SECTION}`}>
          <div
            className="orb left-1/2 top-10 h-[30rem] w-[44rem] -translate-x-1/2 bg-sky/12"
            aria-hidden="true"
          />
          <div className={`${CONTAINER} relative text-center`}>
            <Badge>O diferencial</Badge>
            <h2 className={`mx-auto mt-7 max-w-[24ch] ${H2}`}>
              O Mapa de Calor responde quatro perguntas por lead
            </h2>
            <p className={`mx-auto mt-6 max-w-[58ch] ${LEAD}`}>
              Não é um relatório do que aconteceu. É uma decisão sobre o que
              fazer nos próximos minutos.
            </p>
          </div>

          <div className={`${CONTAINER} relative mt-14`}>
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Quem abordar agora — com o card de lead */}
              <article className="card-night rounded-3xl p-6 lg:col-span-2">
                <p className={`${EYEBROW} text-violet`}>Quem devo abordar agora?</p>
                <h3 className={`mt-4 ${H3}`}>A fila é ordenada por intenção, não por horário</h3>
                <p className={`mt-3 max-w-[54ch] ${BODY}`}>
                  Quem subiu de temperatura hoje aparece antes de quem comentou
                  na semana passada. Cada linha carrega o motivo, então você abre
                  o lead já sabendo o que ele fez.
                </p>
                <div className="mt-6">
                  <LeadCard />
                </div>
              </article>

              {/* Por que — breakdown */}
              <article className="card-night rounded-3xl p-6">
                <p className={`${EYEBROW} text-violet`}>Por que devo abordar?</p>
                <h3 className={`mt-4 ${H3}`}>Nenhum número aparece sem explicação</h3>
                <p className={`mt-3 ${BODY}`}>
                  A nota vem desmontada: cada evento, quanto valeu e quanto já
                  perdeu por decaimento.
                </p>
                <div className="mt-6">
                  <ScoreBreakdown />
                </div>
              </article>

              {/* Dois scores */}
              <article className="card-night rounded-3xl p-6">
                <Layers className="h-6 w-6 text-sky" strokeWidth={1.75} aria-hidden="true" />
                <h3 className={`mt-5 ${H3}`}>Relacionamento e intenção, separados</h3>
                <p className={`mt-3 ${BODY}`}>
                  Gostar de você e querer comprar de você não são a mesma coisa.
                  Score de intenção alto com relacionamento baixo é um
                  desconhecido com pressa — e merece resposta rápida.
                </p>
              </article>

              {/* Afinidade */}
              <article className="card-night rounded-3xl p-6">
                <ListChecks className="h-6 w-6 text-sky" strokeWidth={1.75} aria-hidden="true" />
                <h3 className={`mt-5 ${H3}`}>Sobre qual assunto conversar</h3>
                <p className={`mt-3 ${BODY}`}>
                  A afinidade por tema mostra em quais conteúdos a pessoa
                  interagiu de forma recorrente. Você abre pelo assunto que já
                  prendeu a atenção dela, não com “oi, tudo bem?”.
                </p>
              </article>

              {/* Automático vs humano */}
              <article className="card-night rounded-3xl p-6">
                <div className="flex gap-3">
                  <Bot className="h-6 w-6 text-sky" strokeWidth={1.75} aria-hidden="true" />
                  <UserCheck className="h-6 w-6 text-sky" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <h3 className={`mt-5 ${H3}`}>Automático não conta como abordagem</h3>
                <p className={`mt-3 ${BODY}`}>
                  Mensagem da plataforma e mensagem de gente ficam em trilhas
                  separadas no histórico. Seu número de leads abordados não vem
                  inflado por disparo de robô.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Temperatura */}
        <section className={`relative ${SECTION}`}>
          <div className={`${CONTAINER} text-center`}>
            <Badge>Estados do lead</Badge>
            <h2 className={`mx-auto mt-7 max-w-[22ch] ${H2}`}>
              Quatro temperaturas, uma leitura
            </h2>
            <p className={`mx-auto mt-6 max-w-[58ch] ${LEAD}`}>
              O estado muda sozinho conforme os eventos acontecem — ou deixam de
              acontecer. Ação recente vale mais que ação antiga.
            </p>
          </div>
          <div className={`${CONTAINER} mt-14`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {temperatures.map(({ label, icon: Icon, chip, body }) => (
                <article key={label} className="card-night rounded-2xl p-6">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${chip}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    {label}
                  </span>
                  <p className={`mt-5 ${BODY}`}>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Antes e depois */}
        <section className={`relative ${SECTION}`}>
          <div className={`${CONTAINER} text-center`}>
            <Badge>O problema</Badge>
            <h2 className={`mx-auto mt-7 max-w-[22ch] ${H2}`}>
              O interesse tem prazo de validade
            </h2>
            <p className={`mx-auto mt-6 max-w-[58ch] ${LEAD}`}>
              Um perfil comercial ativo acumula interações o dia inteiro, e o
              time responde quem gritou mais alto ou quem apareceu por último.
              Não é falta de volume. É falta de ordem.
            </p>
          </div>

          <div className={`${CONTAINER} mt-14`}>
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-3xl border border-white/8 bg-white/[0.02] p-6 sm:p-8">
                <p className={`${EYEBROW} text-white/40`}>Como costuma ser</p>
                <h3 className={`mt-4 ${H3}`}>A fila é o relógio</h3>
                <ul className="mt-6 space-y-4">
                  {beforeAfter.before.map((item) => (
                    <li key={item} className="flex gap-3 border-t border-white/8 pt-4 text-sm leading-6 text-white/45">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-white/30" strokeWidth={2.5} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="relative overflow-hidden rounded-3xl border border-violet/25 bg-violet/[0.07] p-6 sm:p-8">
                <div className="orb right-[-6rem] top-[-6rem] h-64 w-64 bg-violet/35" aria-hidden="true" />
                <p className={`${EYEBROW} relative text-violet`}>Com a Comentou</p>
                <h3 className={`relative mt-4 ${H3}`}>A fila é a intenção</h3>
                <ul className="relative mt-6 space-y-4">
                  {beforeAfter.after.map((item) => (
                    <li key={item} className="flex gap-3 border-t border-white/10 pt-4 text-sm leading-6 text-white/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-300" strokeWidth={3} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* Para quem é — com fotos */}
        <section className={`relative ${SECTION}`}>
          <div className={`${CONTAINER} text-center`}>
            <Badge>Para quem é</Badge>
            <h2 className={`mx-auto mt-7 max-w-[24ch] ${H2}`}>
              Se você vende conversando, a fila é o seu gargalo
            </h2>
          </div>
          <div className={`${CONTAINER} mt-14`}>
            <div className="grid gap-4 lg:grid-cols-3">
              {audience.map(({ tag, body, src, alt, pos }) => (
                <article
                  key={tag}
                  className="group relative overflow-hidden rounded-3xl border border-white/10"
                >
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={src}
                      alt={alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className={`object-cover ${pos}`}
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-night via-night/70 to-transparent"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className={`${EYEBROW} text-violet`}>{tag}</p>
                    <p className="mt-3 text-sm leading-6 text-white/75">{body}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-white/35">
              Imagens ilustrativas. Não representam clientes reais nem constituem
              depoimento.
            </p>
          </div>
        </section>

        {/* Clique não é venda */}
        <section className={`relative ${SECTION}`}>
          <div className={CONTAINER}>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-night-2 p-7 sm:p-12">
              <div className="orb left-[-8rem] bottom-[-8rem] h-80 w-80 bg-sky/25" aria-hidden="true" />
              <div className="relative">
                <Badge>A regra mais rígida da plataforma</Badge>
                <h2 className={`mt-7 max-w-[20ch] ${H2}`}>
                  Clique não é venda. Interesse não é venda.
                </h2>
                <p className={`mt-6 max-w-[58ch] ${LEAD}`}>
                  A Comentou nunca converte um sinal em receita por conta
                  própria. Uma venda só entra no sistema quando alguém do seu
                  time confirma manualmente, ou quando ela chega confirmada pelo
                  seu CRM ou checkout.
                </p>
                <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-3">
                  <div className="border-t border-white/12 pt-5">
                    <h3 className="text-base font-bold text-white">O que a plataforma mede</h3>
                    <p className={`mt-2 ${BODY}`}>
                      Eventos verificáveis: comentário, resposta de Story,
                      menção, mensagem iniciada pelo seguidor, clique em link
                      rastreado.
                    </p>
                  </div>
                  <div className="border-t border-white/12 pt-5">
                    <h3 className="text-base font-bold text-white">O que ela não mede sozinha</h3>
                    <p className={`mt-2 ${BODY}`}>
                      Se houve pagamento, qual o valor, se o pedido foi cancelado
                      ou reembolsado. Isso não é observável pela API da Meta.
                    </p>
                  </div>
                  <div className="border-t border-white/12 pt-5">
                    <h3 className="text-base font-bold text-white">Como a venda entra</h3>
                    <p className={`mt-2 ${BODY}`}>
                      Confirmação manual pelo responsável, ou integração com
                      CRM/checkout. Sem uma das duas, o lead continua como
                      oportunidade — não como receita.
                    </p>
                  </div>
                </div>
                <p className="mt-9 max-w-[58ch] text-sm font-semibold leading-6 text-white/80">
                  É por isso que os números do painel não crescem sozinhos. Eles
                  crescem quando alguém confirma que cresceram.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Passos */}
        <section className={`relative ${SECTION}`}>
          <div className={`${CONTAINER} text-center`}>
            <Badge>Configuração</Badge>
            <h2 className={`mx-auto mt-7 max-w-[24ch] ${H2}`}>
              Quatro passos até o primeiro mapa de calor
            </h2>
            <p className={`mx-auto mt-6 max-w-[58ch] ${LEAD}`}>
              Não há instalação, script no site nem migração de dados. A conexão
              é feita pelo login oficial do Instagram.
            </p>
          </div>
          <div className={`${CONTAINER} mt-14`}>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ number, title, body }) => (
                <li key={number} className="card-night rounded-2xl p-6">
                  <p className="font-display text-3xl font-black tabular-nums text-violet">
                    {number}
                  </p>
                  <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
                  <p className={`mt-2 ${BODY}`}>{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center text-xs leading-5 text-white/40">
              Contas profissionais do Instagram (Comercial ou Criador) são
              obrigatórias, porque só elas recebem os eventos pela API oficial da
              Meta.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/cadastro" className={CTA}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Limites */}
        <section className={`relative ${SECTION}`}>
          <div className={`${CONTAINER} text-center`}>
            <Badge>Limites declarados</Badge>
            <h2 className={`mx-auto mt-7 max-w-[20ch] ${H2}`}>
              O que esta plataforma não faz
            </h2>
            <p className={`mx-auto mt-6 max-w-[52ch] ${LEAD}`}>
              Ferramenta séria também se define pelo que se recusa a prometer.
            </p>
          </div>
          <div className={`${CONTAINER} mt-14`}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {limits.map((limit) => (
                <li
                  key={limit}
                  className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-sm leading-6 text-white/50"
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-white/30" strokeWidth={2.5} aria-hidden="true" />
                  {limit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className={`relative ${SECTION}`}>
          <div className={`${CONTAINER} text-center`}>
            <Badge>Perguntas frequentes</Badge>
            <h2 className={`mx-auto mt-7 max-w-[22ch] ${H2}`}>
              Provavelmente você tem uma destas dúvidas
            </h2>
          </div>
          <div className="mx-auto mt-14 w-full max-w-3xl px-5 sm:px-8">
            <div className="space-y-3">
              {faq.map(({ q, a }, index) => (
                <details
                  key={q}
                  className="group card-night rounded-2xl px-5 py-4 sm:px-7"
                  open={index === 0}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-base font-bold text-white">
                    {q}
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 transition-transform duration-150 group-open:rotate-45"
                    >
                      <Plus className="h-4 w-4 text-white" strokeWidth={2.5} />
                    </span>
                  </summary>
                  <p className={`mt-4 ${BODY}`}>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="relative py-24 sm:py-32">
          <div className="dot-grid absolute inset-0" aria-hidden="true" />
          <div
            className="orb left-1/2 top-1/2 h-[28rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 bg-violet/30"
            aria-hidden="true"
          />
          <div className={`${CONTAINER} relative text-center`}>
            <h2 className={`mx-auto max-w-[20ch] ${H2}`}>
              Comece pelo lead que está quente agora
            </h2>
            <p className={`mx-auto mt-6 max-w-[58ch] ${LEAD}`}>
              Crie sua conta, conecte o Instagram pelo login oficial da Meta e
              veja o mapa de calor se formar a partir das interações que já estão
              acontecendo no seu perfil.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/cadastro" className={CTA}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link href="/login" className={CTA_GHOST}>
                Já tenho conta
              </Link>
            </div>
            <p className={`mt-8 text-white/40 ${EYEBROW}`}>
              Cadastro por e-mail · Instagram é conectado depois, dentro da plataforma
            </p>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 bg-night-2">
        <div className={`${CONTAINER} py-14`}>
          <div className="flex flex-col gap-8 border-b border-white/10 pb-10 sm:flex-row sm:items-center sm:justify-between">
            <BrandLogo className="h-auto w-32 brightness-0 invert" />
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <Link href="/privacy" className={`-m-2 p-2 text-white/50 hover:text-white ${EYEBROW}`}>
                Privacidade
              </Link>
              <Link href="/terms" className={`-m-2 p-2 text-white/50 hover:text-white ${EYEBROW}`}>
                Termos de uso
              </Link>
              <Link href="/login" className={`-m-2 p-2 text-white/50 hover:text-white ${EYEBROW}`}>
                Entrar
              </Link>
            </div>
          </div>

          <div className="mt-10 max-w-[88ch] space-y-4 text-xs leading-5 text-white/40">
            <p>
              A Comentou é uma plataforma de organização e priorização de
              relacionamento comercial no Instagram. Ela captura exclusivamente
              interações públicas e mensagens recebidas por meio da API oficial
              da Meta, dentro das permissões que você autoriza e pode revogar a
              qualquer momento.
            </p>
            <p>
              Dados que a Meta não disponibiliza individualmente — como curtidas
              por pessoa e visualizações por pessoa — não são capturados,
              estimados nem inferidos. Os recursos e os campos disponíveis
              dependem do que a Meta oferece para contas profissionais e podem
              mudar sem aviso, por decisão da própria Meta.
            </p>
            <p>
              Clique em link rastreado, comentário, menção e resposta de Story
              são sinais de interesse, não vendas. A Comentou só registra uma
              venda quando ela é confirmada manualmente por um usuário da sua
              equipe ou informada por integração com CRM ou checkout. Scores,
              temperaturas e filas são ferramentas de priorização baseadas em
              eventos registrados, e não previsões de receita.
            </p>
            <p>
              A Comentou não garante vendas, faturamento ou taxa de conversão.
              Resultados dependem da sua oferta, do seu conteúdo, do seu
              atendimento e do seu mercado.
            </p>
            <p>
              Comentou não é afiliada, patrocinada nem endossada pela Meta
              Platforms, Inc. Instagram é marca registrada da Meta Platforms,
              Inc.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
