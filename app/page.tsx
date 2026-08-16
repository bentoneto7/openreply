import type { Metadata } from "next";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import {
  ArrowRight,
  ArrowUpRight,
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

/* Type scale. Display face carries the headlines; the UI face carries prose. */
const DISPLAY =
  "font-display font-black uppercase leading-[0.92] tracking-[-0.03em] text-[clamp(2.5rem,6.6vw,5rem)]";
const H2 =
  "font-display font-black uppercase leading-[0.95] tracking-[-0.025em] text-[clamp(2rem,4.4vw,3.5rem)]";
const H3 = "text-xl font-bold leading-[1.25] tracking-[-0.015em] sm:text-2xl";
const LEAD = "text-pretty text-lg leading-[1.6] sm:text-xl";
const EYEBROW = "font-mono text-[0.6875rem] uppercase tracking-[0.18em]";
const MONO_ITEM = "font-mono text-xs uppercase leading-5 tracking-[0.06em]";

const CONTAINER = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const SECTION = "py-20 sm:py-28 lg:py-32";

const PILL_LIGHT =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold uppercase tracking-[0.08em] text-ink transition-colors duration-150 hover:bg-cream";
const PILL_GHOST_LIGHT =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-8 py-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition-colors duration-150 hover:bg-white/10";
const PILL_DARK =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition-colors duration-150 hover:bg-field-deep";
const PILL_GHOST_DARK =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink/25 px-8 py-4 text-sm font-bold uppercase tracking-[0.08em] text-ink transition-colors duration-150 hover:bg-ink/5";

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

const foundations = [
  {
    icon: ShieldCheck,
    title: "Todo ponto nasce de um evento",
    body: "Comentário, resposta de Story, menção, mensagem iniciada pelo seguidor, clique em link rastreado. Nada é inferido, nada é inventado.",
  },
  {
    icon: ScrollText,
    title: "Histórico imutável",
    body: "Cada evento fica registrado com data, origem e conteúdo. O passado de um lead não é reescrito quando a regra muda.",
  },
  {
    icon: ListChecks,
    title: "Score que se explica",
    body: "Toda nota vem com o detalhamento item a item de como foi formada. Nenhum número aparece sem justificativa.",
  },
];

const questions = [
  {
    n: "01",
    title: "Quem devo abordar agora?",
    body: "A fila é ordenada por intenção medida e recência, não por ordem de chegada. Quem subiu de temperatura hoje aparece antes de quem comentou na semana passada.",
  },
  {
    n: "02",
    title: "Por que devo abordar essa pessoa?",
    body: "Cada posição vem com o motivo: quais eventos ocorreram, quando, e quanto cada um pesou na nota. Você abre o lead já sabendo o que ele fez.",
  },
  {
    n: "03",
    title: "Sobre qual assunto devo conversar?",
    body: "A afinidade por tema mostra em quais conteúdos essa pessoa interagiu de forma recorrente. Você entra na conversa pelo assunto que já prendeu a atenção dela.",
  },
  {
    n: "04",
    title: "Quanto tempo eu tenho?",
    body: "Ação recente vale mais que ação antiga. O painel indica quem está esfriando e quem já esfriou, para você atacar a janela em vez de descobrir depois que ela fechou.",
  },
];

const temperatures = [
  {
    label: "Quentes agora",
    icon: Flame,
    chip: "border-hot-border bg-hot-surface text-hot-ink",
    body: "Demonstraram interesse comercial recentemente e ainda estão dentro da janela em que uma abordagem faz sentido. É deste grupo que sai a fila de hoje.",
  },
  {
    label: "Aquecendo",
    icon: TrendingUp,
    chip: "border-warming-border bg-warming-surface text-warming-ink",
    body: "Aumentaram a frequência ou a profundidade das interações. Ainda não pediram nada, mas a curva está subindo. Bom momento para conteúdo, não para oferta.",
  },
  {
    label: "Esfriando",
    icon: TrendingDown,
    chip: "border-cooling-border bg-cooling-surface text-cooling-ink",
    body: "Já tiveram intenção alta e pararam de interagir. O decaimento por recência derruba a nota dia após dia, então esse grupo é uma janela fechando, não uma lista morta.",
  },
  {
    label: "Reativados",
    icon: RotateCcw,
    chip: "border-revived-border bg-revived-surface text-revived-ink",
    body: "Estavam frios e voltaram a interagir. Reaparecimento depois de silêncio é um sinal diferente de um contato novo, e a plataforma trata os dois de forma diferente.",
  },
];

const breakdown = [
  { pts: 12, label: "Pediu preço hoje", meta: "Comentário · há 2h", positive: true },
  { pts: 9, label: "Clicou no link rastreado 2×", meta: "Link rastreado · ontem", positive: true },
  { pts: 6, label: "Respondeu 3 Stories na semana", meta: "Story · há 4 dias", positive: true },
  { pts: 2, label: "Interações perderam força", meta: "vs. semana anterior", positive: false },
];

const queueRules = [
  {
    title: "Ordenada por decisão, não por horário",
    body: "A pessoa que perguntou preço e clicou no link há duas horas fica acima de quem comentou “top” hoje de manhã.",
  },
  {
    title: "Cada linha carrega o porquê",
    body: "Você não precisa abrir o perfil para saber por que aquele nome está ali. O motivo vem na própria linha.",
  },
  {
    title: "O que você fez fica registrado",
    body: "Abordou, respondeu, marcou como perdido, marcou como ganho: cada desfecho volta para o sistema e ajusta como sinais parecidos são lidos depois.",
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
    body: "Autorização pelo login oficial da Meta, com as permissões exibidas na tela antes de você aceitar. A Comentou nunca pede sua senha do Instagram.",
  },
  {
    number: "03",
    title: "Defina o que é sinal comercial",
    body: "Escolha quais eventos indicam intenção no seu negócio e qual o peso de cada um. Comece pela configuração padrão e ajuste depois — as regras são versionadas.",
  },
  {
    number: "04",
    title: "Trabalhe a fila",
    body: "Assim que os eventos começarem a chegar, o mapa de calor se forma e a fila “quem abordar agora” passa a ser preenchida.",
  },
];

const limits = [
  "Não garante venda, faturamento nem taxa de conversão. Resultado depende da sua oferta, do seu conteúdo, do seu preço e da qualidade da abordagem do seu time.",
  "Não inventa dado que a Meta não entrega. Curtidas individuais, visualizações por pessoa e outros dados não disponibilizados pela API não são estimados nem preenchidos por aproximação.",
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

function Squiggle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 120"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d="M8 96c46-14 92-30 138-46 22-8 46-16 62-6 18 11 12 40-8 50-24 12-56 4-84-4"
        stroke="var(--color-highlight)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeatmapMockup() {
  return (
    <figure className="overflow-hidden rounded-3xl bg-surface p-5 shadow-[0_28px_70px_-28px_rgb(11_18_32/0.45)] ring-1 ring-black/5 sm:p-8">
      <figcaption className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hm-title" className={H3}>
          Mapa de Calor · últimos 7 dias
        </h2>
        <span className={`${EYEBROW} text-muted-strong`}>Exemplo de interface</span>
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

        <rect x="340" y="28" width="268" height="164" fill="#f8fafc" />
        <rect
          x="340"
          y="28"
          width="268"
          height="164"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <g stroke="#e2e8f0" strokeWidth="1">
          <line x1="72" y1="110" x2="608" y2="110" />
          <line x1="72" y1="274" x2="608" y2="274" />
          <line x1="206" y1="28" x2="206" y2="356" />
          <line x1="474" y1="28" x2="474" y2="356" />
        </g>

        <line x1="72" y1="356" x2="608" y2="356" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="72" y1="28" x2="72" y2="356" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="340" y1="28" x2="340" y2="356" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5 5" />
        <line x1="72" y1="192" x2="608" y2="192" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5 5" />

        <g fill="#64748b" fontSize="11" fontWeight="600" letterSpacing="0.08em">
          <text x="596" y="48" textAnchor="end">ABORDAR AGORA</text>
          <text x="84" y="48">NUTRIR</text>
          <text x="596" y="344" textAnchor="end">RESGATAR</text>
          <text x="84" y="344">OBSERVAR</text>
        </g>

        {/* A forma carrega o estado; a cor apenas reforça. */}
        <g stroke="#ffffff" strokeWidth="2">
          <circle cx="544" cy="80" r="7" fill="#b91c1c" />
          <circle cx="479" cy="123" r="7" fill="#b91c1c" />
          <polygon points="415,145 422,158 408,158" fill="#c07d05" />
          <polygon points="351,164 358,177 344,177" fill="#c07d05" />
          <polygon points="300,132 308,140 300,148 292,140" fill="#16a34a" />
          <rect x="286" y="186" width="12" height="12" rx="2" fill="#64748b" />
          <polygon points="249,246 256,233 242,233" fill="#7c3aed" />
          <polygon points="190,292 197,279 183,279" fill="#7c3aed" />
        </g>

        {/* Rótulos diretos: no mobile não cabem, e a tabela sr-only assume. */}
        <g
          className="hidden sm:block"
          fill="#334155"
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

        <text x="340" y="398" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="600">
          Intenção comercial (0–100)
        </text>
        <text
          x="24"
          y="192"
          textAnchor="middle"
          fill="#475569"
          fontSize="12"
          fontWeight="600"
          transform="rotate(-90 24 192)"
        >
          Tendência de interação (7 dias)
        </text>
        <g fill="#64748b" fontSize="11">
          <text x="72" y="374">baixa</text>
          <text x="608" y="374" textAnchor="end">alta</text>
          <text x="60" y="34" textAnchor="end">+50</text>
          <text x="60" y="196" textAnchor="end">0</text>
          <text x="60" y="356" textAnchor="end">−50</text>
        </g>
      </svg>

      {/* Legenda em HTML, não em SVG: acompanha o zoom de texto do navegador. */}
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5">
        <li className="flex items-center gap-2 text-xs font-semibold text-hot-ink">
          <Flame className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Quente · círculo
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-warming-ink">
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Aquecendo · triângulo
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-steady-ink">
          <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Estável · quadrado
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-cooling-ink">
          <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Esfriando · triângulo invertido
        </li>
        <li className="flex items-center gap-2 text-xs font-semibold text-revived-ink">
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

      <p className="mt-4 text-xs leading-5 text-muted-strong">
        Dados ilustrativos. Priorização sugerida a partir de interações
        observadas — não é previsão de compra.
      </p>
    </figure>
  );
}

function LeadCard() {
  return (
    <article className="rounded-3xl bg-surface p-5 shadow-[0_24px_60px_-30px_rgb(11_18_32/0.4)] ring-1 ring-black/5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-bold text-accent"
          >
            AS
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">@ana.studio</p>
            <p className="mt-0.5 truncate text-xs text-muted-strong">
              Curso de fotografia · exemplo de interface
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hot-border bg-hot-surface px-2.5 py-1 text-xs font-bold text-hot-ink">
          <Flame className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Quente
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-5">
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-5xl font-black leading-none tracking-[-0.03em] tabular-nums text-foreground">
            88
          </span>
          <span className="text-sm font-semibold text-muted">/100</span>
          <span className="sr-only">de intenção comercial</span>
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-hot-ink">
          <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          <span className="tabular-nums">+34</span> pts em 7 dias
        </p>
      </div>

      {/* Reforço visual do número que já foi lido acima. */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-steady-surface" aria-hidden="true">
        <div className="h-full rounded-full bg-hot-mark" style={{ width: "88%" }} />
      </div>

      <div className="mt-5 rounded-2xl bg-cream p-4">
        <p className="text-sm leading-6 text-foreground">
          “Quanto custa a turma de março? Consigo parcelar?”
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-strong">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Comentário no Reel “Bastidores”
          <span aria-hidden="true">·</span>
          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          há 2 horas
        </p>
      </div>
    </article>
  );
}

function ScoreBreakdown() {
  return (
    <section
      className="rounded-3xl bg-surface p-5 shadow-[0_24px_60px_-30px_rgb(11_18_32/0.4)] ring-1 ring-black/5 sm:p-6"
      aria-labelledby="por-que"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="por-que" className={H3}>
          Por que este score
        </h3>
        <p className="text-sm font-bold tabular-nums text-muted">88 pts</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-strong">
        Sinais observados nos últimos 7 dias.
      </p>

      <ul className="mt-5 divide-y divide-border">
        {breakdown.map((row) => (
          <li key={row.label} className="flex items-center gap-3 py-3">
            <span
              className={`inline-flex min-w-[3.5rem] shrink-0 items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 text-xs font-black tabular-nums ${
                row.positive
                  ? "bg-revived-surface text-revived-ink"
                  : "bg-steady-surface text-steady-ink"
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
              <span className="block text-sm font-semibold leading-5 text-foreground">
                {row.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-strong">{row.meta}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-xs leading-5 text-muted-strong">
        O score é uma sugestão de prioridade baseada em interações reais
        coletadas pela API oficial da Meta. Não garante interesse, resposta ou
        compra.
      </p>
    </section>
  );
}

export default function Home() {
  return (
    <div className="bg-cream">
      {/* Barra flutuante — legível tanto sobre os campos de cor quanto sobre o creme */}
      <header className="sticky top-3 z-50 px-3 sm:top-4 sm:px-5">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between rounded-full bg-ink/85 pl-5 pr-2 backdrop-blur-md sm:pl-7 sm:pr-3">
          <Link href="/" aria-label="Comentou — início" className="shrink-0">
            <BrandLogo className="h-auto w-28 brightness-0 invert sm:w-32" priority />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#mapa-de-calor"
              className={`hidden min-h-11 items-center rounded-full px-4 text-white/70 transition-colors duration-150 hover:text-white lg:inline-flex ${EYEBROW}`}
            >
              Como funciona
            </a>
            <Link
              href="/login"
              className={`hidden min-h-11 items-center rounded-full px-4 text-white/70 transition-colors duration-150 hover:text-white sm:inline-flex ${EYEBROW}`}
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className={`inline-flex min-h-11 items-center rounded-full bg-white px-5 text-ink transition-colors duration-150 hover:bg-cream ${EYEBROW} font-bold`}
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero — campo de cor chapado */}
        {/* -mt-16 slides the field up behind the floating header (h-16) */}
        <section className="field-grid -mt-16 bg-field pt-36 pb-40 text-white sm:pt-44 sm:pb-48">
          <div className={CONTAINER}>
            <h1 className={`max-w-[16ch] ${DISPLAY}`}>
              Você sabe quem comentou. Não sabe quem abordar.
            </h1>
            <p className={`mt-7 max-w-[54ch] text-white/85 ${LEAD}`}>
              A Comentou lê as interações públicas do seu Instagram pela API
              oficial da Meta, mede intenção comercial e monta um mapa de calor
              que responde quem abordar agora, por quê, sobre qual assunto e
              quanto tempo você tem antes do interesse esfriar.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className={PILL_LIGHT}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link href="/login" className={PILL_GHOST_LIGHT}>
                Já tenho conta
              </Link>
            </div>
            <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
              {trustChips.map(({ icon: Icon, label }) => (
                <li key={label} className={`flex items-center gap-2 text-white/80 ${EYEBROW}`}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Painel sobreposto ao campo do hero */}
        <div className={`${CONTAINER} -mt-28 sm:-mt-32`}>
          <HeatmapMockup />
        </div>

        {/* O que roda sozinho */}
        <section className={`${SECTION} mt-20 bg-ink text-white sm:mt-28`}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-highlight`}>Automaticamente</p>
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {automatic.map(({ title, body }) => (
                <div key={title} className="border-t border-white/20 pt-5">
                  <Check
                    className="h-6 w-6 text-highlight"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <h2 className="mt-4 text-base font-bold leading-snug">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fundamentos */}
        <section className={SECTION}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-accent`}>Como a plataforma se sustenta</p>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {foundations.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="rounded-3xl bg-surface p-7 ring-1 ring-black/5"
                >
                  <Icon className="h-7 w-7 text-accent" strokeWidth={1.75} aria-hidden="true" />
                  <h2 className={`mt-6 ${H3}`}>{title}</h2>
                  <p className="mt-3 text-base leading-7 text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Antes e depois — cards grandes sobrepostos */}
        <section className={`${SECTION} pt-0`}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-accent`}>O problema</p>
            <h2 className={`mt-4 max-w-[18ch] ${H2}`}>
              O interesse tem prazo de validade
            </h2>
            <p className={`mt-6 max-w-[54ch] text-muted ${LEAD}`}>
              Um perfil comercial ativo acumula interações o dia inteiro, e o
              time responde quem gritou mais alto ou quem apareceu por último.
              Não é falta de volume. É falta de ordem.
            </p>

            <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:gap-6">
              <article className="rounded-3xl bg-surface p-7 ring-1 ring-black/5 sm:p-9">
                <p className={`${EYEBROW} text-muted-strong`}>Como costuma ser</p>
                <h3 className={`mt-4 ${H3}`}>A fila é o relógio</h3>
                <ul className="mt-7 space-y-4">
                  {beforeAfter.before.map((item) => (
                    <li
                      key={item}
                      className={`flex gap-3 border-b border-border pb-4 text-muted ${MONO_ITEM}`}
                    >
                      <X
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-strong"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="relative overflow-hidden rounded-3xl bg-field-deep p-7 text-white sm:p-9">
                <Squiggle className="pointer-events-none absolute -top-2 right-2 h-24 w-44 opacity-90" />
                <p className={`${EYEBROW} text-highlight`}>Com a Comentou</p>
                <h3 className={`mt-4 ${H3}`}>A fila é a intenção</h3>
                <ul className="mt-7 space-y-4">
                  {beforeAfter.after.map((item) => (
                    <li
                      key={item}
                      className={`flex gap-3 border-b border-white/15 pb-4 ${MONO_ITEM}`}
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-highlight"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="mt-10 flex justify-center">
              <Link href="/cadastro" className={PILL_DARK}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Mapa de Calor */}
        <section
          id="mapa-de-calor"
          className={`field-grid scroll-mt-24 bg-field text-white ${SECTION}`}
        >
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-highlight`}>O diferencial</p>
            <h2 className={`mt-4 max-w-[18ch] ${H2}`}>
              Quatro perguntas por lead
            </h2>
            <p className={`mt-6 max-w-[54ch] text-white/85 ${LEAD}`}>
              Não é um relatório do que aconteceu. É uma decisão sobre o que
              fazer nos próximos minutos.
            </p>
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {questions.map(({ n, title, body }) => (
                <article key={n} className="border-t border-white/25 pt-6">
                  <p className="font-display text-3xl font-black tabular-nums text-highlight">
                    {n}
                  </p>
                  <h3 className={`mt-4 ${H3}`}>{title}</h3>
                  <p className="mt-3 text-base leading-7 text-white/75">{body}</p>
                </article>
              ))}
            </div>
            <div className="mt-12 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className={PILL_LIGHT}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Temperatura */}
        <section className={SECTION}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-accent`}>Estados do lead</p>
            <h2 className={`mt-4 max-w-[20ch] ${H2}`}>Quatro temperaturas, uma leitura</h2>
            <p className={`mt-6 max-w-[54ch] text-muted ${LEAD}`}>
              Toda pessoa que interage com seu perfil ocupa um dos quatro
              estados abaixo. O estado muda sozinho conforme os eventos
              acontecem — ou deixam de acontecer.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {temperatures.map(({ label, icon: Icon, chip, body }) => (
                <article key={label} className="rounded-3xl bg-surface p-6 ring-1 ring-black/5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${chip}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    {label}
                  </span>
                  <p className="mt-5 text-sm leading-6 text-muted">{body}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 max-w-[62ch] text-sm leading-6 text-muted-strong">
              A temperatura não é um rótulo que você aplica manualmente. Ela é
              consequência dos eventos registrados e do tempo decorrido desde
              cada um.
            </p>
          </div>
        </section>

        {/* Dois scores + auditoria */}
        <section className={`${SECTION} bg-ink text-white`}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-highlight`}>Como a nota é formada</p>
            <h2 className={`mt-4 max-w-[20ch] ${H2}`}>
              Gostar de você não é querer comprar de você
            </h2>
            <p className={`mt-6 max-w-[54ch] text-white/80 ${LEAD}`}>
              A Comentou calcula dois scores separados, porque tratá-los como um
              só é o que faz um time abordar o fã errado e ignorar o comprador
              certo.
            </p>

            <div className="mt-12 grid gap-x-10 gap-y-10 lg:grid-cols-2">
              <article className="border-t border-white/25 pt-6">
                <h3 className={H3}>Score de relacionamento</h3>
                <p className="mt-3 text-base leading-7 text-white/75">
                  Mede vínculo ao longo do tempo: constância das interações,
                  variedade dos formatos em que a pessoa aparece, quanto tempo
                  ela orbita o seu perfil. Um score de relacionamento alto indica
                  alguém presente, não necessariamente alguém pronto para
                  comprar.
                </p>
              </article>
              <article className="border-t border-white/25 pt-6">
                <h3 className={H3}>Score de intenção</h3>
                <p className="mt-3 text-base leading-7 text-white/75">
                  Mede sinal comercial recente: perguntas de preço e
                  disponibilidade, clique em link rastreado, mensagem iniciada
                  pela própria pessoa, retorno ao mesmo assunto. Um score de
                  intenção alto com relacionamento baixo é um desconhecido com
                  pressa — e merece resposta rápida.
                </p>
              </article>
            </div>

            <div className="mt-16 grid items-start gap-10 lg:grid-cols-2">
              <div>
                <h3 className={H3}>Nenhum número aparece sem explicação</h3>
                <p className="mt-3 max-w-[54ch] text-base leading-7 text-white/75">
                  Abra qualquer lead e veja a nota desmontada: cada evento que
                  contribuiu, quanto ele valeu, quando aconteceu e quanto já
                  perdeu por decaimento.
                </p>
                <dl className="mt-8 space-y-6">
                  <div className="border-t border-white/20 pt-5">
                    <dt className={`${EYEBROW} text-highlight`}>Regras versionadas</dt>
                    <dd className="mt-2 text-base leading-7 text-white/75">
                      Quando você muda o peso de um evento, a versão anterior da
                      regra continua registrada. Você sabe qual versão gerou qual
                      nota, e em que período.
                    </dd>
                  </div>
                  <div className="border-t border-white/20 pt-5">
                    <dt className={`${EYEBROW} text-highlight`}>Recálculo sob demanda</dt>
                    <dd className="mt-2 text-base leading-7 text-white/75">
                      O score pode ser recalculado com a regra nova sobre o
                      histórico já existente. Os eventos não mudam — só a leitura
                      deles.
                    </dd>
                  </div>
                </dl>
              </div>
              <ScoreBreakdown />
            </div>
          </div>
        </section>

        {/* Fila de abordagem */}
        <section className={SECTION}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-accent`}>Do painel para a ação</p>
            <h2 className={`mt-4 max-w-[18ch] ${H2}`}>
              Sua próxima hora de trabalho, em ordem
            </h2>
            <p className={`mt-6 max-w-[54ch] text-muted ${LEAD}`}>
              A fila “quem abordar agora” é a saída prática do mapa de calor: uma
              lista ordenada, com o motivo ao lado de cada nome e o assunto
              sugerido para abrir a conversa.
            </p>
            <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_0.85fr]">
              <ul className="space-y-8">
                {queueRules.map(({ title, body }) => (
                  <li key={title} className="flex gap-4 border-t border-border pt-6">
                    <ArrowUpRight
                      className="mt-1 h-6 w-6 shrink-0 text-accent"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{title}</h3>
                      <p className="mt-2 max-w-[54ch] text-base leading-7 text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <LeadCard />
            </div>
          </div>
        </section>

        {/* Clique ≠ venda — bloco de alto contraste */}
        <section className={`${SECTION} bg-highlight text-ink`}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-ink/70`}>A regra mais rígida da plataforma</p>
            <h2 className={`mt-4 max-w-[16ch] ${H2}`}>
              Clique não é venda. Interesse não é venda.
            </h2>
            <p className={`mt-6 max-w-[56ch] text-ink/80 ${LEAD}`}>
              A Comentou nunca converte um sinal em receita por conta própria.
              Uma venda só entra no sistema quando alguém do seu time confirma
              manualmente, ou quando ela chega confirmada pelo seu CRM ou
              checkout.
            </p>
            <div className="mt-12 grid gap-x-10 gap-y-8 lg:grid-cols-3">
              <div className="border-t border-ink/25 pt-5">
                <h3 className="text-lg font-bold">O que a plataforma mede</h3>
                <p className="mt-2 text-base leading-7 text-ink/75">
                  Eventos verificáveis: comentário, resposta de Story, menção,
                  mensagem iniciada pelo seguidor, clique em link rastreado.
                </p>
              </div>
              <div className="border-t border-ink/25 pt-5">
                <h3 className="text-lg font-bold">O que ela não mede sozinha</h3>
                <p className="mt-2 text-base leading-7 text-ink/75">
                  Se houve pagamento, qual o valor, se o pedido foi cancelado ou
                  reembolsado. Isso não é observável pela API da Meta.
                </p>
              </div>
              <div className="border-t border-ink/25 pt-5">
                <h3 className="text-lg font-bold">Como a venda entra</h3>
                <p className="mt-2 text-base leading-7 text-ink/75">
                  Confirmação manual pelo responsável, ou integração com
                  CRM/checkout. Sem uma das duas, o lead continua como
                  oportunidade — não como receita.
                </p>
              </div>
            </div>
            <p className="mt-10 max-w-[62ch] text-base font-semibold leading-7">
              É por isso que os números do painel não crescem sozinhos. Eles
              crescem quando alguém confirma que cresceram.
            </p>
          </div>
        </section>

        {/* Perfil 360 e afinidade */}
        <section className={SECTION}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-accent`}>Contexto antes da mensagem</p>
            <h2 className={`mt-4 max-w-[20ch] ${H2}`}>
              Entre na conversa sabendo o que já aconteceu
            </h2>
            <p className={`mt-6 max-w-[54ch] text-muted ${LEAD}`}>
              O perfil 360° reúne, em uma linha do tempo única, tudo que aquela
              pessoa fez publicamente com o seu perfil e tudo que o seu time fez
              com ela.
            </p>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              <article className="rounded-3xl bg-surface p-7 ring-1 ring-black/5">
                <UserCheck className="h-7 w-7 text-accent" strokeWidth={1.75} aria-hidden="true" />
                <h3 className={`mt-6 ${H3}`}>Linha do tempo do lead</h3>
                <ul className={`mt-5 space-y-3 text-muted ${MONO_ITEM}`}>
                  <li>Comentários, respostas de Story e menções, com texto original e data</li>
                  <li>Mensagens iniciadas pela própria pessoa no Direct</li>
                  <li>Cliques em links rastreados, ligados ao conteúdo de origem</li>
                  <li>Mensagens automáticas, identificadas como automáticas</li>
                  <li>Abordagens humanas, identificadas com o responsável</li>
                  <li>Mudanças de temperatura e de score, com a data</li>
                </ul>
              </article>

              <article className="rounded-3xl bg-surface p-7 ring-1 ring-black/5">
                <Layers className="h-7 w-7 text-accent" strokeWidth={1.75} aria-hidden="true" />
                <h3 className={`mt-6 ${H3}`}>Afinidade por tema</h3>
                <p className="mt-3 text-base leading-7 text-muted">
                  A plataforma agrupa os conteúdos com que cada pessoa interagiu
                  e mostra os temas recorrentes. Em vez de abrir com um “oi, tudo
                  bem?”, você abre pelo assunto em que ela já se envolveu mais de
                  uma vez.
                </p>
              </article>

              <article className="rounded-3xl bg-surface p-7 ring-1 ring-black/5">
                <ListChecks className="h-7 w-7 text-accent" strokeWidth={1.75} aria-hidden="true" />
                <h3 className={`mt-6 ${H3}`}>Conteúdos que convertem</h3>
                <p className="mt-3 text-base leading-7 text-muted">
                  Nem todo post que engaja gera intenção. A Comentou separa o
                  conteúdo que rende comentário do conteúdo que rende pergunta de
                  preço, clique e mensagem no Direct — e mostra os dois de forma
                  separada.
                </p>
              </article>
            </div>

            <p className="mt-8 max-w-[62ch] text-sm leading-6 text-muted-strong">
              O histórico é imutável. Eventos não são editados nem apagados para
              “limpar” um lead: se mudou de status, isso também vira um registro
              na linha do tempo.
            </p>
          </div>
        </section>

        {/* Automático ≠ humano */}
        <section className={`${SECTION} bg-field-deep text-white`}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-highlight`}>Registro separado</p>
            <h2 className={`mt-4 max-w-[20ch] ${H2}`}>
              Uma resposta automática não é uma abordagem
            </h2>
            <p className={`mt-6 max-w-[54ch] text-white/80 ${LEAD}`}>
              As duas coisas acontecem na mesma caixa de entrada e são
              registradas em trilhas diferentes, porque confundir uma com a outra
              é o jeito mais rápido de superestimar o próprio trabalho comercial.
            </p>
            <div className="mt-12 grid gap-x-10 gap-y-10 lg:grid-cols-2">
              <article className="border-t border-white/25 pt-6">
                <Bot className="h-7 w-7 text-highlight" strokeWidth={1.75} aria-hidden="true" />
                <h3 className={`mt-5 ${H3}`}>Mensagem automática</h3>
                <p className="mt-3 text-base leading-7 text-white/75">
                  Enviada pela plataforma no Direct a partir de uma regra que
                  você configurou. Serve para não deixar a pessoa esperando e
                  para qualificar. Fica marcada como automática no histórico, com
                  a regra que a disparou.
                </p>
              </article>
              <article className="border-t border-white/25 pt-6">
                <UserCheck className="h-7 w-7 text-highlight" strokeWidth={1.75} aria-hidden="true" />
                <h3 className={`mt-5 ${H3}`}>Abordagem humana</h3>
                <p className="mt-3 text-base leading-7 text-white/75">
                  Enviada por alguém do seu time, com nome e horário registrados.
                  É o que efetivamente conta como trabalho comercial nos
                  relatórios de fila e de desfecho.
                </p>
              </article>
            </div>
            <p className="mt-10 max-w-[62ch] text-base leading-7 text-white/70">
              Quando você olhar quantos leads foram realmente abordados, o número
              não vai estar inflado por mensagens que um robô disparou.
            </p>
          </div>
        </section>

        {/* Como começar */}
        <section className={SECTION}>
          <div className={CONTAINER}>
            <p className={`${EYEBROW} text-accent`}>Configuração</p>
            <h2 className={`mt-4 max-w-[18ch] ${H2}`}>
              Quatro passos até o primeiro mapa de calor
            </h2>
            <p className={`mt-6 max-w-[54ch] text-muted ${LEAD}`}>
              Não há instalação, script no site nem migração de dados. A conexão
              é feita pelo login oficial do Instagram.
            </p>
            <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ number, title, body }) => (
                <li key={number} className="border-t-2 border-ink pt-5">
                  <p className="font-display text-4xl font-black tabular-nums text-accent">
                    {number}
                  </p>
                  <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-base leading-7 text-muted">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10 max-w-[62ch] text-sm leading-6 text-muted-strong">
              Contas profissionais do Instagram (Comercial ou Criador) são
              obrigatórias, porque só elas recebem os eventos pela API oficial da
              Meta.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className={PILL_DARK}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link href="/login" className={PILL_GHOST_DARK}>
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>

        {/* Limites declarados */}
        <section className={`${SECTION} pt-0`}>
          <div className={CONTAINER}>
            <div className="rounded-3xl bg-surface p-7 ring-1 ring-black/5 sm:p-10">
              <p className={`${EYEBROW} text-muted-strong`}>Limites declarados</p>
              <h2 className={`mt-4 max-w-[16ch] ${H2}`}>O que esta plataforma não faz</h2>
              <p className="mt-5 max-w-[54ch] text-base leading-7 text-muted">
                Ferramenta séria também se define pelo que se recusa a prometer.
              </p>
              <ul className="mt-9 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                {limits.map((limit) => (
                  <li
                    key={limit}
                    className={`flex gap-3 border-t border-border pt-5 text-muted ${MONO_ITEM}`}
                  >
                    <X
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-strong"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    {limit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={`${SECTION} pt-0`}>
          <div className={CONTAINER}>
            <h2 className={`max-w-[16ch] ${H2}`}>Perguntas frequentes</h2>
            <div className="mt-10 space-y-3">
              {faq.map(({ q, a }, index) => (
                <details
                  key={q}
                  className="group rounded-3xl bg-surface px-6 py-5 ring-1 ring-black/5 sm:px-8"
                  open={index === 0}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-lg font-bold text-foreground">
                    {q}
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream transition-transform duration-150 group-open:rotate-45"
                    >
                      <Plus className="h-4 w-4 text-ink" strokeWidth={2.5} />
                    </span>
                  </summary>
                  <p className="mt-4 max-w-[70ch] text-base leading-7 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className={`field-grid bg-field py-24 text-white sm:py-32`}>
          <div className={`${CONTAINER} text-center`}>
            <h2 className={`mx-auto max-w-[16ch] ${H2}`}>
              Comece pelo lead que está quente agora
            </h2>
            <p className={`mx-auto mt-6 max-w-[54ch] text-white/85 ${LEAD}`}>
              Crie sua conta, conecte o Instagram pelo login oficial da Meta e
              veja o mapa de calor se formar a partir das interações que já estão
              acontecendo no seu perfil.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/cadastro" className={PILL_LIGHT}>
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link href="/login" className={PILL_GHOST_LIGHT}>
                Já tenho conta
              </Link>
            </div>
            <p className={`mt-8 text-white/70 ${EYEBROW}`}>
              Cadastro por e-mail · Instagram é conectado depois, dentro da plataforma
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-white">
        <div className={`${CONTAINER} py-16`}>
          <div className="flex flex-col gap-8 border-b border-white/15 pb-10 sm:flex-row sm:items-center sm:justify-between">
            <BrandLogo className="h-auto w-32 brightness-0 invert" />
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <Link href="/privacy" className={`-m-2 p-2 text-white/70 hover:text-white ${EYEBROW}`}>
                Privacidade
              </Link>
              <Link href="/terms" className={`-m-2 p-2 text-white/70 hover:text-white ${EYEBROW}`}>
                Termos de uso
              </Link>
              <Link href="/login" className={`-m-2 p-2 text-white/70 hover:text-white ${EYEBROW}`}>
                Entrar
              </Link>
            </div>
          </div>

          <div className="mt-10 max-w-[88ch] space-y-4 text-xs leading-5 text-white/55">
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
