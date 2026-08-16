// DDD (dois dígitos, nenhum deles 0) seguido de celular (9 + 8 dígitos) ou
// fixo (2-5 + 7 dígitos). Solto de propósito: não valida se o DDD existe, só
// descarta o que não pode ser um número brasileiro.
const BR_LOCAL = /^[1-9][1-9](?:9\d{8}|[2-5]\d{7})$/;

/**
 * Normaliza um WhatsApp brasileiro para só dígitos com DDI
 * ("5511987654321"), aceitando o que as pessoas realmente digitam:
 * "+55 (11) 98765-4321", "11 98765 4321", "(11) 3456-7890".
 *
 * É um campo de contato para o dono falar com o cliente, não uma identidade.
 * Devolve null quando o valor não tem como ser um número brasileiro.
 */
export function normalizeWhatsapp(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  // Sem DDI: é assim que o cliente escreve o próprio número.
  if (BR_LOCAL.test(digits)) return `55${digits}`;

  // Já veio com o +55.
  if (digits.startsWith("55") && BR_LOCAL.test(digits.slice(2))) return digits;

  return null;
}
