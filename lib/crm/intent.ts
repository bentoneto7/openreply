import type { LeadIntentCategory, LeadIntentSource } from "@/app/generated/prisma/client";

export type ClassifiedLeadIntent = {
  category: LeadIntentCategory;
  signals: string[];
  source: LeadIntentSource;
};

const SIGNAL_RULES: Array<{
  category: LeadIntentCategory;
  signal: string;
  pattern: RegExp;
}> = [
  { category: "PURCHASE", signal: "purchase_phrase", pattern: /\b(quero comprar|vou comprar|como comprar|fechar pedido|fazer pedido|adquirir)\b/ },
  { category: "PRICE", signal: "price_term", pattern: /\b(preco|valor|quanto custa|investimento|parcela|parcelamento)\b/ },
  { category: "LINK", signal: "link_term", pattern: /\b(link|site|pagina|onde compro|onde comprar)\b/ },
  { category: "URGENCY", signal: "urgency_term", pattern: /\b(agora|hoje|urgente|imediato|rapido|prazo)\b/ },
  { category: "COMPARISON", signal: "comparison_term", pattern: /\b(comparar|comparacao|versus|vs|melhor que|diferenca)\b/ },
  { category: "OBJECTION", signal: "objection_term", pattern: /\b(caro|desconto|frete|garantia|nao sei|duvida se)\b/ },
  { category: "SUPPORT", signal: "support_term", pattern: /\b(suporte|ajuda|erro|problema|nao funciona|troca|reembolso)\b/ },
  { category: "STRONG_INTEREST", signal: "interest_phrase", pattern: /\b(tenho interesse|me interessa|eu quero|me chama|manda pra mim)\b/ },
  { category: "NO_COMMERCIAL_INTENT", signal: "social_only", pattern: /\b(parabens|amei|lindo|top|obrigad[oa]|show)\b/ },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyLeadIntent(text: string, matchedKeyword?: string | null): ClassifiedLeadIntent {
  const normalizedText = normalize(text);
  const normalizedKeyword = matchedKeyword ? normalize(matchedKeyword).slice(0, 80) : "";
  const matches = SIGNAL_RULES.filter((rule) => rule.pattern.test(normalizedText));
  const signals = matches.map((match) => match.signal);

  if (normalizedKeyword) signals.push(`matched_keyword:${normalizedKeyword}`);
  if (normalizedText.includes("?")) signals.push("question_mark");

  let category = matches[0]?.category ?? "UNKNOWN";
  if (category === "UNKNOWN" && normalizedText.includes("?")) category = "QUESTION";
  if (category === "UNKNOWN" && normalizedKeyword) {
    const keywordMatch = SIGNAL_RULES.find((rule) => rule.pattern.test(normalizedKeyword));
    category = keywordMatch?.category ?? "STRONG_INTEREST";
  }

  return {
    category,
    signals: [...new Set(signals)].slice(0, 12),
    source: "RULE",
  };
}
