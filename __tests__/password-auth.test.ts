import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password-auth";

describe("password authentication", () => {
  it("hashes with a unique salt and verifies without storing plaintext", async () => {
    const first = await hashPassword("SenhaSegura123!");
    const second = await hashPassword("SenhaSegura123!");
    expect(first).not.toBe(second);
    expect(first).not.toContain("SenhaSegura123!");
    expect(await verifyPassword("SenhaSegura123!", first)).toBe(true);
    expect(await verifyPassword("senha-errada", first)).toBe(false);
  });
});
