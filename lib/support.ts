// Único canal de suporte do Comentou. Trocar o número aqui muda todos os links.
// Formato wa.me: código do país (55) + DDD + número, sem "+", espaços ou traços.
export const SUPPORT_WHATSAPP = "5541988969127";

/** Link do WhatsApp do suporte, com a mensagem já preenchida. */
export function supportWhatsAppLink(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
