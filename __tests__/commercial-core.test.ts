import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyLeadIntent } from "@/lib/crm/intent";
import { fingerprintRequest, sanitizeEventMetadata } from "@/lib/crm/event-metadata";
import { getMeasurementStatus, measuredValue } from "@/lib/crm/results";
import {
  canChangeOpportunityAssignee,
  decodeOpportunityCursor,
  encodeOpportunityCursor,
  validateOpportunityOutcome,
} from "@/lib/crm/opportunity";

describe("commercial intent classifier", () => {
  it("classifies accents deterministically and exposes explainable signals", () => {
    expect(classifyLeadIntent("Qual é o preço e parcelamento?")).toEqual({
      category: "PRICE",
      signals: ["price_term", "question_mark"],
      source: "RULE",
    });
  });

  it("uses the matched keyword as a deterministic fallback", () => {
    expect(classifyLeadIntent("manda", "LINK")).toEqual({
      category: "LINK",
      signals: ["matched_keyword:link"],
      source: "RULE",
    });
  });
});

describe("commercial event privacy", () => {
  it("removes credentials and bounds persisted metadata", () => {
    expect(
      sanitizeEventMetadata({
        changedFields: ["status"],
        accessToken: "never-store-this",
        nested: { Authorization: "Bearer abc", note: "x".repeat(600) },
      })
    ).toEqual({ changedFields: ["status"], nested: { note: "x".repeat(500) } });
  });

  it("fingerprints objects independently of key order without exposing values", () => {
    expect(fingerprintRequest({ b: 2, a: 1 })).toBe(fingerprintRequest({ a: 1, b: 2 }));
    expect(fingerprintRequest({ a: 2 })).not.toBe(fingerprintRequest({ a: 1 }));
  });

  it("does not collapse distinct values after the audit metadata limit", () => {
    expect(fingerprintRequest({ note: `${"x".repeat(500)}a` })).not.toBe(
      fingerprintRequest({ note: `${"x".repeat(500)}b` })
    );
  });
});

describe("opportunity contract rules", () => {
  it("round-trips a stable pagination cursor and rejects malformed cursors", () => {
    const cursor = { id: "lead_1", updatedAt: "2026-09-02T12:00:00.000Z" };
    expect(decodeOpportunityCursor(encodeOpportunityCursor(cursor))).toEqual(cursor);
    expect(decodeOpportunityCursor("not-a-cursor")).toBeNull();
  });

  it("requires a confirmed sale to win and a reason to lose", () => {
    expect(
      validateOpportunityOutcome({
        currentStatus: "NEGOCIANDO",
        currentLossReason: null,
        next: { expectedVersion: 1, idempotencyKey: "request-1", status: "GANHO" },
        hasConfirmedSale: false,
      })
    ).toMatch(/venda confirmada/i);
    expect(
      validateOpportunityOutcome({
        currentStatus: "NEGOCIANDO",
        currentLossReason: null,
        next: { expectedVersion: 1, idempotencyKey: "request-2", status: "PERDIDO" },
        hasConfirmedSale: false,
      })
    ).toMatch(/motivo da perda/i);
  });

  it("keeps a confirmed win terminal until the sale is explicitly voided", () => {
    expect(
      validateOpportunityOutcome({
        currentStatus: "GANHO",
        currentLossReason: null,
        next: {
          expectedVersion: 3,
          idempotencyKey: "request-reopen-win",
          status: "NEGOCIANDO",
        },
        hasConfirmedSale: true,
      })
    ).toMatch(/anulação explícita/i);
  });

  it("does not register a second confirmed sale on the same opportunity", () => {
    expect(
      validateOpportunityOutcome({
        currentStatus: "GANHO",
        currentLossReason: null,
        next: {
          expectedVersion: 3,
          idempotencyKey: "request-second-sale",
          status: "GANHO",
          sale: { amountCents: 15_000, currency: "BRL" },
        },
        hasConfirmedSale: true,
      })
    ).toMatch(/já possui uma venda confirmada/i);
  });

  it("keeps a lost opportunity terminal until an audited reopen action exists", () => {
    expect(
      validateOpportunityOutcome({
        currentStatus: "PERDIDO",
        currentLossReason: "Sem orçamento",
        next: {
          expectedVersion: 4,
          idempotencyKey: "request-reopen-loss",
          status: "NEGOCIANDO",
        },
        hasConfirmedSale: false,
      })
    ).toMatch(/reaberta.*auditada/i);
  });

  it("lets members self-assign but reserves assignment of peers to admins", () => {
    expect(
      canChangeOpportunityAssignee({
        role: "MEMBER",
        actorMemberId: "member_1",
        currentAssigneeMemberId: null,
        nextAssigneeMemberId: "member_1",
      })
    ).toBe(true);
    expect(
      canChangeOpportunityAssignee({
        role: "MEMBER",
        actorMemberId: "member_1",
        currentAssigneeMemberId: null,
        nextAssigneeMemberId: "member_2",
      })
    ).toBe(false);
    expect(
      canChangeOpportunityAssignee({
        role: "MEMBER",
        actorMemberId: "member_1",
        currentAssigneeMemberId: "member_2",
        nextAssigneeMemberId: "member_1",
      })
    ).toBe(false);
    expect(
      canChangeOpportunityAssignee({
        role: "ADMIN",
        actorMemberId: "member_1",
        currentAssigneeMemberId: null,
        nextAssigneeMemberId: "member_2",
      })
    ).toBe(true);
  });
});

describe("results measurement coverage", () => {
  const from = new Date("2026-09-01T00:00:00.000Z");
  const to = new Date("2026-09-02T00:00:00.000Z");

  it("keeps unavailable distinct from a measured zero", () => {
    expect(getMeasurementStatus(null, from, to)).toBe("unavailable");
    expect(measuredValue("unavailable", 0)).toBeNull();
    expect(measuredValue("measured", 0)).toBe(0);
  });

  it("marks a range crossing the first event as partial", () => {
    expect(getMeasurementStatus(new Date("2026-09-01T12:00:00.000Z"), from, to)).toBe("partial");
  });
});

describe("commercial migration invariants", () => {
  const migration = readFileSync(
    path.resolve(
      process.cwd(),
      "prisma/migrations/20260902120000_add_commercial_core/migration.sql"
    ),
    "utf8"
  );

  it("keeps new campaigns and shared reports fail-closed", () => {
    expect(migration).toContain('ALTER COLUMN "isActive" SET DEFAULT false');
    expect(migration).toContain(
      'ALTER COLUMN "reportShareEnabled" SET DEFAULT false'
    );
  });

  it("enforces at most one confirmed sale per opportunity", () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "Sale_one_confirmed_per_lead_key"');
    expect(migration).toContain('WHERE "status" = \'CONFIRMED\'');
  });
});
