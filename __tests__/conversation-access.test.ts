import { describe, expect, it } from "vitest";
import type { InstagramConversation } from "@/lib/meta/client";
import {
  findOwnedConversation,
  isOwnedConversation,
} from "@/lib/meta/conversation-access";

const conversations: InstagramConversation[] = [
  {
    id: "conversation_1",
    participants: {
      data: [
        { id: "instagram_business", username: "marca" },
        { id: "contact_1", username: "maria" },
      ],
    },
    messages: { data: [] },
  },
];

describe("findOwnedConversation", () => {
  it("aceita somente uma conversa da conta com o destinatário informado", () => {
    expect(
      findOwnedConversation(
        conversations,
        "instagram_business",
        "conversation_1",
        "contact_1"
      )
    ).toBe(conversations[0]);
  });

  it("recusa conversa, conta ou destinatário que não correspondem", () => {
    expect(
      findOwnedConversation(
        conversations,
        "instagram_business",
        "conversation_other",
        "contact_1"
      )
    ).toBeUndefined();
    expect(
      findOwnedConversation(
        conversations,
        "instagram_other",
        "conversation_1",
        "contact_1"
      )
    ).toBeUndefined();
    expect(
      findOwnedConversation(
        conversations,
        "instagram_business",
        "conversation_1",
        "contact_other"
      )
    ).toBeUndefined();
  });

  it("nunca trata a própria conta como destinatário", () => {
    expect(
      findOwnedConversation(
        conversations,
        "instagram_business",
        "conversation_1",
        "instagram_business"
      )
    ).toBeUndefined();
  });

  it("recusa conversa sem a conta ou sem participante externo", () => {
    expect(
      isOwnedConversation(
        {
          id: "foreign",
          participants: { data: [{ id: "contact_1" }] },
        },
        "instagram_business"
      )
    ).toBe(false);
    expect(
      isOwnedConversation(
        {
          id: "self_only",
          participants: { data: [{ id: "instagram_business" }] },
        },
        "instagram_business"
      )
    ).toBe(false);
  });
});
