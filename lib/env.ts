import { z } from "zod";
import type { NextRequest } from "next/server";

const HEX_32_BYTE = /^[a-f0-9]{64}$/i;

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function requireEnv(name: string): string {
  return readEnv(name);
}

export function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/** Uses the public request origin for browser-facing OAuth redirects. */
export function getRequestBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin || getBaseUrl();

  const protocol =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function getEncryptionKeyHex(): string {
  const value = readEnv("ENCRYPTION_KEY");
  if (!HEX_32_BYTE.test(value)) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string");
  }
  return value;
}

// Env vars that must be present before an Instagram OAuth round trip can even
// start. Checked up front so a self-hoster with a half-filled .env gets the
// variable names back instead of an unhandled throw from requireEnv().
const INSTAGRAM_OAUTH_ENV = [
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  "ENCRYPTION_KEY",
  "NEXTAUTH_SECRET",
] as const;

export function getMissingInstagramOAuthEnv(): string[] {
  return INSTAGRAM_OAUTH_ENV.filter((name) => {
    const value = process.env[name];
    if (!value) return true;
    // A malformed key fails later inside encryptToken, after the user has
    // already round-tripped through Meta — catch the bad format here instead.
    return name === "ENCRYPTION_KEY" && !HEX_32_BYTE.test(value);
  });
}

/**
 * Instagram scopes to request at login. Defaults to the two that work at
 * Standard Access; comments and insights need App Review first, and requesting
 * an unapproved scope poisons the whole grant rather than being ignored.
 * Override with INSTAGRAM_SCOPES (comma-separated) once review clears them.
 */
export function getInstagramScopes(): string[] {
  const configured = process.env.INSTAGRAM_SCOPES;
  if (configured) {
    return configured
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }
  return ["instagram_business_basic", "instagram_business_manage_messages"];
}

export function getMetaGraphApiVersion(): string {
  // v26.0 is what Meta's current Instagram Platform reference uses. A version
  // graph.instagram.com no longer serves is not rejected as a bad version — it
  // is parsed as a node ID, so the request degrades into an unroutable GET and
  // comes back as "Unsupported request - method type: get", naming neither the
  // version nor the problem.
  return process.env.META_GRAPH_API_VERSION ?? "v26.0";
}

export function isBillingEnforcementEnabled(): boolean {
  return process.env.BILLING_ENFORCEMENT_ENABLED === "true";
}

export const serverEnvSchema = z.object({
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().regex(HEX_32_BYTE),
  INSTAGRAM_APP_ID: z.string().min(1),
  INSTAGRAM_APP_SECRET: z.string().min(1),
  FACEBOOK_APP_SECRET: z.string().min(1),
  WEBHOOK_VERIFY_TOKEN: z.string().min(1),
});

export function validateCoreEnv() {
  return serverEnvSchema.parse(process.env);
}
