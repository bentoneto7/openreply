import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { getEncryptionKeyHex, getInstagramScopes, requireEnv } from "@/lib/env";
import { unwrapSingle } from "@/lib/meta/client";

// www is the documented authorize host for Instagram Business Login, and what
// Meta's own dashboard puts in the embedded login URL. api.instagram.com still
// 302s here, but it drops the percent-encoding on redirect_uri along the way —
// not worth the hop. The token exchange below stays on api.
const INSTAGRAM_OAUTH_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  workspaceId: string;
  ts: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signState(payload: string): string {
  return createHmac("sha256", requireEnv("NEXTAUTH_SECRET"))
    .update(payload)
    .digest("base64url");
}

export function createOAuthState(workspaceId: string): string {
  const payload = base64UrlEncode(
    JSON.stringify({ workspaceId, ts: Date.now() } satisfies OAuthStatePayload)
  );
  return `${payload}.${signState(payload)}`;
}

export function verifyOAuthState(state: string | null): OAuthStatePayload | null {
  if (!state) return null;

  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = signState(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as OAuthStatePayload;
    if (!parsed.workspaceId || Date.now() - parsed.ts > STATE_MAX_AGE_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("INSTAGRAM_APP_ID"),
    redirect_uri: redirectUri,
    // Only scopes the Meta app actually has configured. Asking for one it does
    // not — manage_comments and manage_insights are still "add to app review"
    // on this app — yields a token that authenticates but carries no grants, so
    // every graph.instagram.com call, /me included, comes back as code 100
    // "Unsupported request". Add them back here once App Review clears them.
    scope: getInstagramScopes().join(","),
    response_type: "code",
    state,
  });

  return `${INSTAGRAM_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; userId: string; expiresIn?: number }> {
  const body = new URLSearchParams({
    client_id: requireEnv("INSTAGRAM_APP_ID"),
    client_secret: requireEnv("INSTAGRAM_APP_SECRET"),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Token exchange failed: ${error.error_message || JSON.stringify(error)}`
    );
  }

  const data = unwrapSingle<{
    access_token?: string;
    user_id?: string | number;
    expires_in?: number;
    permissions?: string | string[];
  }>(await response.json());

  // Meta states the granted scopes here, and a grant can come back narrower
  // than requested without the request itself failing. That produces a token
  // which authenticates but can call nothing, so surface it rather than letting
  // it show up later as an unexplained code 100 on every endpoint.
  const granted = Array.isArray(data.permissions)
    ? data.permissions
    : (data.permissions ?? "").split(",").filter(Boolean);
  if (granted.length > 0 && !granted.includes("instagram_business_basic")) {
    throw new Error(
      `Instagram granted no basic access. Scopes returned: ${granted.join("|") || "(none)"}`
    );
  }

  // A missing token here used to travel on as `undefined` and only blow up at
  // the long-lived exchange, where Meta reports it as an unrelated routing
  // error. Fail at the step that actually went wrong.
  if (!data.access_token) {
    throw new Error("Token exchange returned no access_token");
  }

  return {
    accessToken: data.access_token,
    userId: String(data.user_id),
    // Meta already states this token's lifetime here. Passing it on beats
    // assuming 60 days downstream: if the real window is shorter, an assumed
    // expiry parks the account outside the refresh cron's T-10d selection and
    // it dies silently while settings still shows it healthy.
    expiresIn: data.expires_in,
  };
}

function getEncryptionKey(): Buffer {
  return Buffer.from(getEncryptionKeyHex(), "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString("base64");
}

export function decryptToken(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8"
  );
}
