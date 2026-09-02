import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "@/lib/security/safe-error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logServerError", () => {
  it("registra classificação sem mensagem, token ou PII da exceção", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(
      new Error(
        "falha para pessoa@example.com com access_token=IGAA-segredo e texto privado"
      ),
      { code: 190, subcode: 463 }
    );

    logServerError("[Inbox] erro", error);

    expect(consoleSpy).toHaveBeenCalledWith("[Inbox] erro", {
      name: "Error",
      code: 190,
      subcode: 463,
    });
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain("IGAA-segredo");
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain(
      "pessoa@example.com"
    );
  });
});
