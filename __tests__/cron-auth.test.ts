import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

const originalCronSecret = process.env.CRON_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/test", {
    headers: authorization ? { authorization } : undefined,
  });
}

beforeEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.NEXTAUTH_SECRET;
});

afterAll(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalNextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
});

describe("isAuthorizedCronRequest", () => {
  it("falha fechado quando CRON_SECRET não está configurado", () => {
    expect(isAuthorizedCronRequest(request("Bearer undefined"))).toBe(false);
    expect(isAuthorizedCronRequest(request("Bearer "))).toBe(false);
  });

  it("não reutiliza NEXTAUTH_SECRET como credencial do cron", () => {
    process.env.NEXTAUTH_SECRET = "auth-secret";
    expect(isAuthorizedCronRequest(request("Bearer auth-secret"))).toBe(false);
  });

  it("aceita apenas o CRON_SECRET exato", () => {
    process.env.CRON_SECRET = "cron-secret";
    expect(isAuthorizedCronRequest(request("Bearer cron-secret"))).toBe(true);
    expect(isAuthorizedCronRequest(request("Bearer wrong-secret"))).toBe(false);
    expect(isAuthorizedCronRequest(request("Basic cron-secret"))).toBe(false);
  });
});
