import { describe, expect, it } from "vitest";
import {
  COPILOT_OUTPUT_LIMITS,
  generateCommercialCopilot,
} from "@/lib/crm/copilot";

describe("generateCommercialCopilot", () => {
  it("gera contexto factual e três rascunhos sujeitos a aprovação humana", () => {
    const result = generateCommercialCopilot({
      history: [
        { role: "business", content: "Como posso ajudar?" },
        { role: "contact", content: "Gostei, mas achei caro. Tem outra condição?" },
      ],
      intentCategory: "OBJECTION",
      signals: ["objection_term"],
      status: "RESPONDEU",
      offer: "Plano Essencial",
    });

    expect(result.summary).toContain("Gostei, mas achei caro");
    expect(result.summary).toContain("Oferta informada: Plano Essencial");
    expect(result.observedObjection).toBe(
      "Sinal de preocupação com preço ou condição comercial."
    );
    expect(result.qualificationQuestion).toContain("condição");
    expect(Object.keys(result.drafts)).toEqual(["short", "consultative", "direct"]);
    expect(result.drafts.short).toContain("Plano Essencial");
    expect(result.recommendation.kind).toBe("FOLLOW_UP");
    expect(result.metadata).toMatchObject({
      mode: "deterministic_fallback",
      requiresHumanApproval: true,
      autoSend: false,
    });
  });

  it("funciona sem histórico e sem campos opcionais", () => {
    const result = generateCommercialCopilot({});
    const serialized = JSON.stringify(result);

    expect(result.summary).toBe(
      "Sem histórico ou contexto comercial suficiente para resumir."
    );
    expect(result.observedObjection).toBeNull();
    expect(result.qualificationQuestion).toBe(
      "O que você gostaria de entender antes de decidir?"
    );
    expect(result.recommendation.kind).toBe("FOLLOW_UP");
    expect(serialized).not.toContain("undefined");
    expect(result.metadata.reasons).toContain("Histórico do contato não informado.");
  });

  it("não inventa preço, link ou benefício quando eles não foram informados", () => {
    const result = generateCommercialCopilot({
      history: [{ role: "contact", content: "Quero comprar" }],
      intentCategory: "PURCHASE",
      status: "NOVO",
    });
    const generatedText = [
      result.summary,
      result.qualificationQuestion,
      ...Object.values(result.drafts),
      result.recommendation.text,
    ].join(" ");

    expect(generatedText).not.toMatch(/R\$|https?:\/\/|www\.|%|frete gr[aá]tis/i);
    expect(generatedText).not.toMatch(/desconto de|garantia de|benef[ií]cio/i);
  });

  it("recomenda somente a próxima ação efetivamente recebida", () => {
    const result = generateCommercialCopilot({
      intentCategory: "STRONG_INTEREST",
      status: "NEGOCIANDO",
      nextAction: "Confirmar a modalidade escolhida",
    });

    expect(result.recommendation).toEqual({
      kind: "FOLLOW_UP",
      text: "Revisar e executar a próxima ação registrada: Confirmar a modalidade escolhida.",
    });
  });

  it.each([
    ["GANHO", "ganha"],
    ["PERDIDO", "perdida"],
  ] as const)("recomenda encerramento para status %s", (status, expectedWord) => {
    const result = generateCommercialCopilot({ status });

    expect(result.recommendation.kind).toBe("CLOSE");
    expect(result.recommendation.text).toContain(expectedWord);
  });

  it("não atribui uma objeção sem expressão explícita no histórico", () => {
    const result = generateCommercialCopilot({
      history: [{ role: "contact", content: "Pode me explicar melhor?" }],
      intentCategory: "OBJECTION",
      signals: ["objection_term"],
    });

    expect(result.observedObjection).toBeNull();
    expect(result.metadata.reasons).toContain(
      "Nenhuma objeção explícita foi reconhecida no histórico."
    );
  });

  it("limita textos longos e remove caracteres de controle", () => {
    const longText = `\u0000${"contexto ".repeat(200)}`;
    const result = generateCommercialCopilot({
      history: [{ role: "contact", content: longText }],
      intentCategory: "QUESTION",
      offer: longText,
      nextAction: longText,
    });

    expect(result.summary.length).toBeLessThanOrEqual(COPILOT_OUTPUT_LIMITS.summary);
    expect(result.qualificationQuestion.length).toBeLessThanOrEqual(
      COPILOT_OUTPUT_LIMITS.qualificationQuestion
    );
    for (const draft of Object.values(result.drafts)) {
      expect(draft.length).toBeLessThanOrEqual(COPILOT_OUTPUT_LIMITS.draft);
      expect(draft).not.toMatch(/[\u0000-\u001F\u007F]/);
    }
    expect(result.recommendation.text.length).toBeLessThanOrEqual(
      COPILOT_OUTPUT_LIMITS.recommendation
    );
    expect(result.metadata.reasons).toHaveLength(COPILOT_OUTPUT_LIMITS.reasons);
    expect(result.metadata.reasons.every((reason) => reason.length <= COPILOT_OUTPUT_LIMITS.reason)).toBe(true);
  });
});
