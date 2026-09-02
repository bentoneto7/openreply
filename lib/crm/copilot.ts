import type { LeadIntentCategory } from "@/app/generated/prisma/client";
import { LEAD_STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/lead-status";

export type CopilotHistoryMessage = {
  role: "contact" | "business";
  content: string;
};

export type CommercialCopilotInput = {
  history?: readonly CopilotHistoryMessage[] | null;
  intentCategory?: LeadIntentCategory | null;
  signals?: readonly string[] | null;
  status?: LeadStatusValue | null;
  offer?: string | null;
  nextAction?: string | null;
};

export type CommercialCopilotOutput = {
  summary: string;
  observedObjection: string | null;
  qualificationQuestion: string;
  drafts: {
    short: string;
    consultative: string;
    direct: string;
  };
  recommendation: {
    kind: "FOLLOW_UP" | "CLOSE";
    text: string;
  };
  metadata: {
    mode: "deterministic_fallback";
    requiresHumanApproval: true;
    autoSend: false;
    reasons: string[];
  };
};

export const COPILOT_OUTPUT_LIMITS = {
  summary: 360,
  objection: 120,
  qualificationQuestion: 180,
  draft: 360,
  recommendation: 260,
  reason: 140,
  reasons: 5,
} as const;

const INTENT_LABEL: Record<LeadIntentCategory, string> = {
  PRICE: "preço",
  LINK: "acesso ou link",
  PURCHASE: "compra",
  QUESTION: "dúvida",
  OBJECTION: "objeção",
  COMPARISON: "comparação",
  URGENCY: "urgência",
  STRONG_INTEREST: "forte interesse",
  SUPPORT: "suporte",
  NO_COMMERCIAL_INTENT: "sem intenção comercial",
  UNKNOWN: "não definida",
};

const OBJECTION_RULES: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern:
      /\b(caro|cara|preco alto|valor alto|fora do (meu )?orcamento|nao cabe no (meu )?orcamento|desconto)\b/,
    label: "Sinal de preocupação com preço ou condição comercial.",
  },
  {
    pattern:
      /\b(frete caro|entrega demora|entrega demorada|prazo longo|demora muito|nao chega|nao entrega)\b/,
    label: "Sinal de preocupação com prazo ou entrega.",
  },
  {
    pattern:
      /\b(nao confio|tenho receio|tenho medo|parece golpe|e confiavel|tem garantia|sem garantia)\b/,
    label: "Sinal de preocupação com confiança ou garantia.",
  },
  {
    pattern:
      /\b(nao consigo pagar|cartao recusado|sem cartao|nao tenho cartao|nao consigo parcelar)\b/,
    label: "Sinal de dificuldade com a forma de pagamento.",
  },
  {
    pattern: /\b(vou pensar|nao sei ainda|talvez depois|agora nao|depois eu vejo)\b/,
    label: "Sinal de hesitação para avançar agora.",
  },
];

function clean(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";

  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeForRules(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function withPeriod(value: string): string {
  if (!value) return value;
  return /[.!?…]$/.test(value) ? value : `${value}.`;
}

function latestContactMessage(history: readonly CopilotHistoryMessage[]): string {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.role === "contact") {
      const content = clean(message.content, 140);
      if (content) return content;
    }
  }
  return "";
}

function findObservedObjection(history: readonly CopilotHistoryMessage[]): string | null {
  const contactText = history
    .filter((message) => message?.role === "contact")
    .slice(-12)
    .map((message) => clean(message.content, 320))
    .filter(Boolean)
    .join(" ");

  if (!contactText) return null;
  const normalized = normalizeForRules(contactText);
  const matchedRule = OBJECTION_RULES.find((rule) => rule.pattern.test(normalized));

  return matchedRule ? clean(matchedRule.label, COPILOT_OUTPUT_LIMITS.objection) : null;
}

function qualificationQuestion(
  intentCategory: LeadIntentCategory,
  observedObjection: string | null
): string {
  if (observedObjection?.includes("preço")) {
    return "Qual condição você precisa avaliar para saber se faz sentido avançar?";
  }
  if (observedObjection?.includes("prazo")) {
    return "Para quando você precisa receber ou concluir isso?";
  }
  if (observedObjection?.includes("confiança")) {
    return "Qual informação ajudaria você a avaliar isso com segurança?";
  }
  if (observedObjection?.includes("pagamento")) {
    return "Qual condição de pagamento você precisa confirmar?";
  }
  if (observedObjection?.includes("hesitação")) {
    return "O que ainda falta esclarecer para você decidir?";
  }

  const questions: Record<LeadIntentCategory, string> = {
    PRICE: "Qual condição comercial você precisa entender primeiro?",
    LINK: "Qual oferta ou produto você quer acessar?",
    PURCHASE: "Qual opção você quer confirmar para avançar?",
    QUESTION: "Qual ponto você quer esclarecer primeiro?",
    OBJECTION: "O que está impedindo você de avançar neste momento?",
    COMPARISON: "Quais opções você está comparando e o que pesa mais na decisão?",
    URGENCY: "Para quando você precisa resolver isso?",
    STRONG_INTEREST: "O que você precisa confirmar para avançar?",
    SUPPORT: "Qual problema ocorreu e em qual etapa?",
    NO_COMMERCIAL_INTENT: "Você precisa de alguma informação comercial ou podemos encerrar por aqui?",
    UNKNOWN: "O que você gostaria de entender antes de decidir?",
  };

  return clean(questions[intentCategory], COPILOT_OUTPUT_LIMITS.qualificationQuestion);
}

function makeSummary(
  latestMessage: string,
  intentCategory: LeadIntentCategory,
  status: LeadStatusValue | null,
  offer: string
): string {
  const facts: string[] = [];

  if (latestMessage) facts.push(`Última mensagem do contato: “${latestMessage}”`);
  if (intentCategory !== "UNKNOWN") {
    facts.push(`Intenção registrada: ${INTENT_LABEL[intentCategory]}`);
  }
  if (status) facts.push(`Etapa atual: ${LEAD_STATUS_LABEL[status]}`);
  if (offer) facts.push(`Oferta informada: ${offer}`);

  if (facts.length === 0) {
    return "Sem histórico ou contexto comercial suficiente para resumir.";
  }

  return clean(facts.map(withPeriod).join(" "), COPILOT_OUTPUT_LIMITS.summary);
}

function makeRecommendation(
  status: LeadStatusValue | null,
  intentCategory: LeadIntentCategory,
  nextAction: string,
  observedObjection: string | null
): CommercialCopilotOutput["recommendation"] {
  if (status === "GANHO") {
    return {
      kind: "CLOSE",
      text: "Encerrar o acompanhamento comercial: a oportunidade já está marcada como ganha.",
    };
  }
  if (status === "PERDIDO") {
    return {
      kind: "CLOSE",
      text: "Encerrar sem novo contato: a oportunidade já está marcada como perdida.",
    };
  }
  if (intentCategory === "NO_COMMERCIAL_INTENT") {
    return {
      kind: "CLOSE",
      text: "Encerrar como sem intenção comercial, salvo se o contato iniciar uma nova conversa.",
    };
  }
  if (nextAction) {
    return {
      kind: "FOLLOW_UP",
      text: clean(
        `Revisar e executar a próxima ação registrada: ${withPeriod(nextAction)}`,
        COPILOT_OUTPUT_LIMITS.recommendation
      ),
    };
  }
  if (observedObjection) {
    return {
      kind: "FOLLOW_UP",
      text: "Responder à objeção observada e fazer a pergunta de qualificação após revisão humana.",
    };
  }

  const followUpByStatus: Partial<Record<LeadStatusValue, string>> = {
    NOVO: "Fazer o primeiro contato usando um rascunho revisado e registrar o retorno.",
    ABORDADO: "Aguardar a resposta e revisar o contexto antes de um novo contato.",
    RESPONDEU: "Fazer a pergunta de qualificação e registrar a resposta.",
    NEGOCIANDO: "Definir a pendência atual e registrar uma próxima ação concreta.",
  };

  return {
    kind: "FOLLOW_UP",
    text:
      (status && followUpByStatus[status]) ||
      "Revisar o contexto e decidir se há motivo para um follow-up humano.",
  };
}

/**
 * Gera orientação comercial local e explicável. O resultado é somente um
 * rascunho: esta função não acessa rede, não persiste dados e não envia mensagens.
 */
export function generateCommercialCopilot(
  input: CommercialCopilotInput
): CommercialCopilotOutput {
  const history = Array.isArray(input.history) ? input.history.slice(-20) : [];
  const intentCategory = input.intentCategory ?? "UNKNOWN";
  const status = input.status ?? null;
  const offer = clean(input.offer, 100);
  const nextAction = clean(input.nextAction, 140);
  const signalCount = Array.isArray(input.signals)
    ? input.signals
        .map((signal) => clean(signal, 80))
        .filter(Boolean)
        .slice(0, 12).length
    : 0;
  const latestMessage = latestContactMessage(history);
  const observedObjection = findObservedObjection(history);
  const question = qualificationQuestion(intentCategory, observedObjection);
  const offerContext = offer ? ` sobre “${offer}”` : "";
  const signalSummary =
    signalCount === 0
      ? "nenhum sinal classificatório recebido"
      : signalCount === 1
        ? "1 sinal classificatório recebido"
        : `${signalCount} sinais classificatórios recebidos`;
  const acknowledgement = observedObjection
    ? "Entendi o ponto que você trouxe."
    : "Obrigado pela mensagem.";

  const reasons = [
    "Orientação gerada por regras locais e determinísticas.",
    "Qualquer uso do texto depende de revisão e ação humana.",
    latestMessage
      ? "O resumo usa somente o histórico recebido."
      : "Histórico do contato não informado.",
    offer
      ? `A oferta citada foi fornecida na entrada; ${signalSummary}.`
      : `Oferta não informada; nenhum detalhe comercial foi acrescentado; ${signalSummary}.`,
    observedObjection
      ? "A objeção foi reconhecida por termos explícitos no histórico."
      : "Nenhuma objeção explícita foi reconhecida no histórico.",
  ]
    .map((reason) => clean(reason, COPILOT_OUTPUT_LIMITS.reason))
    .slice(0, COPILOT_OUTPUT_LIMITS.reasons);

  return {
    summary: makeSummary(latestMessage, intentCategory, status, offer),
    observedObjection,
    qualificationQuestion: question,
    drafts: {
      short: clean(
        `Oi! ${acknowledgement}${offerContext} ${question}`,
        COPILOT_OUTPUT_LIMITS.draft
      ),
      consultative: clean(
        `Olá! ${acknowledgement} Quero entender seu contexto${offerContext} para orientar o próximo passo com precisão. ${question}`,
        COPILOT_OUTPUT_LIMITS.draft
      ),
      direct: clean(
        `Vamos ao ponto${offerContext}: ${question}`,
        COPILOT_OUTPUT_LIMITS.draft
      ),
    },
    recommendation: makeRecommendation(
      status,
      intentCategory,
      nextAction,
      observedObjection
    ),
    metadata: {
      mode: "deterministic_fallback",
      requiresHumanApproval: true,
      autoSend: false,
      reasons,
    },
  };
}
