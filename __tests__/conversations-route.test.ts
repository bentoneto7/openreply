import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockAuth, mockAccounts, mockMeta, mockOauth } = vi.hoisted(() => ({
  mockAuth: { getCurrentWorkspaceId: vi.fn() },
  mockAccounts: { getWorkspaceInstagramAccount: vi.fn() },
  mockMeta: {
    getConversations: vi.fn(),
    getConversationMessages: vi.fn(),
    sendDirectMessage: vi.fn(),
    MetaApiError: class MetaApiError extends Error {},
  },
  mockOauth: { decryptToken: vi.fn() },
}));

vi.mock("@/lib/auth", () => mockAuth);
vi.mock("@/lib/instagram-accounts", () => mockAccounts);
vi.mock("@/lib/meta/client", () => mockMeta);
vi.mock("@/lib/meta/oauth", () => mockOauth);

import {
  GET as GET_CONVERSATIONS,
  POST,
} from "@/app/api/instagram/conversations/route";
import { GET as GET_MESSAGES } from "@/app/api/instagram/conversations/[id]/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/instagram/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  instagramAccountId: "account_1",
  conversationId: "conversation_1",
  recipientId: "contact_1",
  text: "Olá!",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getCurrentWorkspaceId.mockResolvedValue("workspace_1");
  mockAccounts.getWorkspaceInstagramAccount.mockResolvedValue({
    id: "account_1",
    instagramId: "instagram_business",
    accessToken: "encrypted",
  });
  mockOauth.decryptToken.mockReturnValue("token");
  mockMeta.getConversations.mockResolvedValue([
    {
      id: "conversation_1",
      participants: {
        data: [
          { id: "instagram_business" },
          { id: "contact_1" },
        ],
      },
    },
  ]);
  mockMeta.sendDirectMessage.mockResolvedValue({ message_id: "message_1" });
});

describe("POST /api/instagram/conversations", () => {
  it("recusa uma conta solicitada fora do workspace antes de consultar a Meta", async () => {
    mockAccounts.getWorkspaceInstagramAccount.mockResolvedValueOnce(null);

    const response = await POST(
      request({ ...validBody, instagramAccountId: "account_foreign" })
    );

    expect(response.status).toBe(400);
    expect(mockAccounts.getWorkspaceInstagramAccount).toHaveBeenCalledWith(
      "workspace_1",
      "account_foreign"
    );
    expect(mockMeta.getConversations).not.toHaveBeenCalled();
    expect(mockMeta.sendDirectMessage).not.toHaveBeenCalled();
  });

  it("recusa destinatário que não pertence à conversa da conta", async () => {
    const response = await POST(
      request({ ...validBody, recipientId: "contact_other" })
    );

    expect(response.status).toBe(404);
    expect(mockMeta.sendDirectMessage).not.toHaveBeenCalled();
  });

  it("envia somente depois de validar conta, conversa e destinatário", async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(mockAccounts.getWorkspaceInstagramAccount).toHaveBeenCalledWith(
      "workspace_1",
      "account_1"
    );
    expect(mockMeta.sendDirectMessage).toHaveBeenCalledWith(
      "token",
      "instagram_business",
      "contact_1",
      "Olá!"
    );
  });
});

describe("GET /api/instagram/conversations", () => {
  it("não devolve conversa que a Meta não associa à conta selecionada", async () => {
    mockMeta.getConversations.mockResolvedValueOnce([
      {
        id: "conversation_1",
        participants: {
          data: [
            { id: "instagram_business" },
            { id: "contact_1", username: "maria" },
          ],
        },
      },
      {
        id: "conversation_foreign",
        participants: {
          data: [
            { id: "instagram_other" },
            { id: "contact_other", username: "outra" },
          ],
        },
      },
    ]);

    const response = await GET_CONVERSATIONS(
      new NextRequest(
        "http://localhost/api/instagram/conversations?instagramAccountId=account_1"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.data.conversations).toHaveLength(1);
    expect(payload.data.conversations[0].id).toBe("conversation_1");
  });
});

describe("GET /api/instagram/conversations/[id]", () => {
  it("não lê mensagens antes de confirmar que a conversa pertence à conta", async () => {
    mockMeta.getConversations.mockResolvedValueOnce([
      {
        id: "conversation_foreign",
        participants: {
          data: [
            { id: "instagram_other" },
            { id: "contact_other" },
          ],
        },
      },
    ]);

    const response = await GET_MESSAGES(
      new NextRequest(
        "http://localhost/api/instagram/conversations/conversation_foreign?instagramAccountId=account_1"
      ),
      { params: Promise.resolve({ id: "conversation_foreign" }) }
    );

    expect(response.status).toBe(404);
    expect(mockMeta.getConversationMessages).not.toHaveBeenCalled();
  });
});
