import { createHash } from "node:crypto";

type JsonPrimitive = string | number | boolean | null;
export type SafeJson = JsonPrimitive | SafeJson[] | { [key: string]: SafeJson };

const FORBIDDEN_KEY = /(authorization|cookie|password|secret|token|access.?token|refresh.?token|email|phone|whatsapp|ip.?address|user.?agent)/i;
const SECRET_VALUE = /^(bearer\s+|basic\s+|eyJ[A-Za-z0-9_-]+\.)/i;

function sanitizeValue(value: unknown, depth: number): SafeJson | undefined {
  if (depth > 4 || value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    if (SECRET_VALUE.test(value)) return "[REDACTED]";
    return value.slice(0, 500);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item): item is SafeJson => item !== undefined);
  }
  if (typeof value === "object") {
    const output: Record<string, SafeJson> = {};
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
      if (FORBIDDEN_KEY.test(key)) continue;
      const sanitized = sanitizeValue(item, depth + 1);
      if (sanitized !== undefined) output[key] = sanitized;
    }
    return output;
  }
  return undefined;
}

export function sanitizeEventMetadata(value: unknown): SafeJson {
  return sanitizeValue(value, 0) ?? null;
}

function stableFingerprintStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableFingerprintStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined && typeof item !== "function" && typeof item !== "symbol")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableFingerprintStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function fingerprintRequest(value: unknown) {
  // The digest is never persisted as readable metadata, so it can cover the
  // complete validated command. Using the redacted/truncated audit payload here
  // would make two distinct long notes look idempotently identical.
  return createHash("sha256").update(stableFingerprintStringify(value)).digest("hex");
}
