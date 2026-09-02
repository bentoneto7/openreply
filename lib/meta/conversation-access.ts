import type { InstagramConversation } from "@/lib/meta/client";

export function isOwnedConversation(
  conversation: InstagramConversation,
  instagramAccountId: string,
  recipientId?: string
) {
  const participantIds = new Set(
    (conversation.participants?.data ?? [])
      .map((participant) => participant.id)
      .filter(Boolean)
  );
  if (!participantIds.has(instagramAccountId)) return false;

  const hasExternalParticipant = [...participantIds].some(
    (participantId) => participantId !== instagramAccountId
  );
  if (!hasExternalParticipant) return false;
  if (recipientId && recipientId === instagramAccountId) return false;
  if (recipientId && !participantIds.has(recipientId)) return false;

  return true;
}

/**
 * Confirma que a conversa pertence à conta conectada e, quando informado, que
 * o destinatário é o outro participante. IDs recebidos do cliente nunca são
 * suficientes para autorizar leitura ou envio.
 */
export function findOwnedConversation(
  conversations: InstagramConversation[],
  instagramAccountId: string,
  conversationId: string,
  recipientId?: string
) {
  return conversations.find(
    (conversation) =>
      conversation.id === conversationId &&
      isOwnedConversation(conversation, instagramAccountId, recipientId)
  );
}
