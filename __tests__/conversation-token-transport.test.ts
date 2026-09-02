import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConversationMessages,
  getConversations,
} from "@/lib/meta/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transporte do token da Meta na inbox", () => {
  it("usa Authorization no lugar de colocar o token na URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: { data: [] } }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await getConversations("IGAA-segredo", "instagram_business");
    await getConversationMessages("IGAA-segredo", "conversation_1");

    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain("IGAA-segredo");
      expect(String(url)).not.toContain("access_token");
      expect(init).toEqual({
        headers: { Authorization: "Bearer IGAA-segredo" },
      });
    }
  });
});
