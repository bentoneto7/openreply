import { afterEach, describe, expect, it, vi } from "vitest";

// subscription.ts pulls in the Prisma client for syncSubscription; the gate
// itself is pure, so the client never gets touched here.
vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { nextOnboardingStep } from "../lib/billing/subscription";
import { normalizeWhatsapp } from "../lib/utils/phone";

afterEach(() => {
  delete process.env.BILLING_ENFORCEMENT_ENABLED;
});

describe("nextOnboardingStep", () => {
  it("sends a fresh account to connect Instagram first", () => {
    expect(
      nextOnboardingStep(
        { instagramConnected: false, subscriptionStatus: "NONE" },
        true
      )
    ).toBe("/settings");
  });

  it("sends a connected but unpaid account to checkout", () => {
    expect(
      nextOnboardingStep(
        { instagramConnected: true, subscriptionStatus: "NONE" },
        true
      )
    ).toBe("/billing");
  });

  it("lets an active subscription through", () => {
    expect(
      nextOnboardingStep(
        { instagramConnected: true, subscriptionStatus: "ACTIVE" },
        true
      )
    ).toBeNull();
  });

  it("treats a trial as paid", () => {
    expect(
      nextOnboardingStep(
        { instagramConnected: true, subscriptionStatus: "TRIALING" },
        true
      )
    ).toBeNull();
  });

  it.each(["PAST_DUE", "CANCELED", "UNPAID", "PAUSED", "INCOMPLETE"] as const)(
    "treats %s as unpaid",
    (status) => {
      expect(
        nextOnboardingStep(
          { instagramConnected: true, subscriptionStatus: status },
          true
        )
      ).toBe("/billing");
    }
  );

  it("gates nothing when enforcement is off", () => {
    expect(
      nextOnboardingStep({
        instagramConnected: false,
        subscriptionStatus: "CANCELED",
      })
    ).toBeNull();
  });

  it("reads the env flag when the caller does not pass one", () => {
    process.env.BILLING_ENFORCEMENT_ENABLED = "true";
    expect(
      nextOnboardingStep({
        instagramConnected: true,
        subscriptionStatus: "NONE",
      })
    ).toBe("/billing");
  });
});

describe("normalizeWhatsapp", () => {
  it.each([
    ["(11) 98765-4321", "5511987654321"],
    ["11987654321", "5511987654321"],
    ["11 9 8765 4321", "5511987654321"],
    ["+55 (11) 98765-4321", "5511987654321"],
    ["55 11 98765 4321", "5511987654321"],
    ["+5511987654321", "5511987654321"],
    // Fixo, sem o 9.
    ["(11) 3456-7890", "551134567890"],
    ["+55 11 3456-7890", "551134567890"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeWhatsapp(input)).toBe(expected);
  });

  it.each(["", "1198765", "abc", "1198765432109876", "+1 415 555 2671"])(
    "rejects %s",
    (input) => {
      expect(normalizeWhatsapp(input)).toBeNull();
    }
  );
});
