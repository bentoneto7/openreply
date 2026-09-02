import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import {
  getConversations,
  sendDirectMessage,
  MetaApiError,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import {
  findOwnedConversation,
  isOwnedConversation,
} from "@/lib/meta/conversation-access";
import { logServerError } from "@/lib/security/safe-error";
import { z } from "zod";

export interface ConversationListItem {
  id: string;
  contact: { id: string; username: string | null };
  updatedTime: string | null;
  lastMessage: {
    text: string;
    fromMe: boolean;
    createdTime: string | null;
  } | null;
}

export interface ConversationsResponse {
  conversations: ConversationListItem[];
  account: { id: string; username: string; instagramId: string };
}

const sendMessageSchema = z.object({
  instagramAccountId: z.string().min(1).optional(),
  conversationId: z.string().min(1),
  recipientId: z.string().min(1),
  text: z.string().trim().min(1).max(1000),
});

// List the account's DM conversations for the inbox.
export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Conta do Instagram não conectada." },
      { status: 400 }
    );
  }

  try {
    const accessToken = decryptToken(account.accessToken);
    const raw = await getConversations(accessToken, account.instagramId);

    const conversations: ConversationListItem[] = raw
      .filter((conversation) =>
        isOwnedConversation(conversation, account.instagramId)
      )
      .map((c) => {
      const participants = c.participants?.data ?? [];
      const contact =
        participants.find((p) => p.id !== account.instagramId) ?? null;
      const last = c.messages?.data?.[0] ?? null;

      return {
        id: c.id,
        contact: {
          id: contact?.id ?? "",
          username: contact?.username ?? null,
        },
        updatedTime: c.updated_time ?? null,
        lastMessage: last
          ? {
              text: last.message ?? "",
              fromMe: last.from?.id === account.instagramId,
              createdTime: last.created_time ?? null,
            }
          : null,
      };
    });

    const data: ConversationsResponse = {
      conversations,
      account: {
        id: account.id,
        username: account.username,
        instagramId: account.instagramId,
      },
    };
    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logServerError("[Conversations] Error", err);
    const message =
      err instanceof MetaApiError
        ? err.message
        : "Não foi possível carregar as conversas";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Send a direct message reply.
export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const parsed = sendMessageSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Conversa, destinatário e mensagem são obrigatórios." },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    body.instagramAccountId ?? null
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Conta do Instagram não conectada." },
      { status: 400 }
    );
  }

  try {
    const accessToken = decryptToken(account.accessToken);
    const conversations = await getConversations(
      accessToken,
      account.instagramId
    );
    const conversation = findOwnedConversation(
      conversations,
      account.instagramId,
      body.conversationId,
      body.recipientId
    );
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversa não encontrada nesta conta." },
        { status: 404 }
      );
    }

    const result = await sendDirectMessage(
      accessToken,
      account.instagramId,
      body.recipientId,
      body.text
    );
    return NextResponse.json(
      { success: true, data: result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logServerError("[Conversations] Send error", err);
    // Surface Meta's own message — the common case is the 24-hour messaging
    // window having closed, which the user needs to see explicitly.
    const message =
      err instanceof MetaApiError ? err.message : "Não foi possível enviar a mensagem";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
