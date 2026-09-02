import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateCtr,
  intentCommentFilter,
  normalizeTopKeywords,
  summarizeDmStatuses,
  summarizeIntentComments,
} from "../lib/tracking/analytics";
import {
  buildTrackedUrl,
  extractFirstUrl,
  renderMessageWithTracking,
  replaceUrlWithTrackedPlaceholder,
} from "../lib/tracking/message";

describe("tracked link messages", () => {
  it("extracts a destination URL and replaces it with the tracked placeholder", () => {
    const message =
      "Hey {username}, here is your guide: https://example.com/guide.";
    const url = extractFirstUrl(message);

    expect(url).toBe("https://example.com/guide");
    expect(replaceUrlWithTrackedPlaceholder(message, url)).toBe(
      "Hey {username}, here is your guide: {link}."
    );
  });

  it("renders tracked URLs with username personalization", () => {
    expect(
      renderMessageWithTracking({
        message: "Hey {username}, grab it here: {link}",
        commenterName: "Maya",
        trackedLinks: [
          {
            slug: "abc123",
            destinationUrl: "https://example.com/guide",
          },
        ],
        baseUrl: "https://manychat-alternative.com",
      })
    ).toBe("Hey Maya, grab it here: https://manychat-alternative.com/r/abc123");
  });

  it("can replace a raw destination URL when the placeholder is missing", () => {
    expect(
      renderMessageWithTracking({
        message: "Link: https://example.com/guide",
        trackedLinks: [
          {
            slug: "abc123",
            destinationUrl: "https://example.com/guide",
          },
        ],
        baseUrl: "https://manychat-alternative.com/",
      })
    ).toBe("Link: https://manychat-alternative.com/r/abc123");
  });

  it("matches normalized root URLs with or without trailing slash", () => {
    expect(
      replaceUrlWithTrackedPlaceholder("Link: https://example.com", "https://example.com/")
    ).toBe("Link: {link}");
    expect(
      renderMessageWithTracking({
        message: "Link: https://example.com",
        trackedLinks: [
          {
            slug: "abc123",
            destinationUrl: "https://example.com/",
          },
        ],
        baseUrl: "https://manychat-alternative.com",
      })
    ).toBe("Link: https://manychat-alternative.com/r/abc123");
  });

  it("builds redirect URLs from a base URL", () => {
    expect(buildTrackedUrl("abc123", "https://manychat-alternative.com/")).toBe(
      "https://manychat-alternative.com/r/abc123"
    );
  });
});

describe("campaign analytics helpers", () => {
  it("summarizes DM status rows", () => {
    expect(
      summarizeDmStatuses([
        { status: "SENT", _count: 20 },
        { status: "FAILED", _count: 2 },
        { status: "SKIPPED_RATE_LIMIT", _count: 3 },
        { status: "SKIPPED_PLAN_LIMIT", _count: 1 },
      ])
    ).toEqual({ sent: 20, skipped: 4, failed: 2 });
  });

  it("calculates CTR and reports empty send volume as no data, not 0%", () => {
    expect(calculateCtr(5, 20)).toBe(25);
    expect(calculateCtr(2, 3)).toBe(66.7);
    expect(calculateCtr(0, 20)).toBe(0);
    expect(calculateCtr(5, 0)).toBeNull();
  });

  it("preserves repeated click events instead of hiding them behind a 100% cap", () => {
    expect(calculateCtr(3, 2)).toBe(150);
  });

  it("counts one comment once even when several campaigns matched it", () => {
    const rows = [
      { commentId: "c1", createdAt: new Date(2026, 7, 1, 10) },
      { commentId: "c1", createdAt: new Date(2026, 7, 1, 10) },
      { commentId: "c1", createdAt: new Date(2026, 7, 1, 10) },
      { commentId: "c2", createdAt: new Date(2026, 7, 2, 9) },
    ];

    expect(summarizeIntentComments(rows, 3)).toEqual({ total: 2, daily: [1, 1, 0] });
  });

  it("normalizes top keywords by count", () => {
    expect(
      normalizeTopKeywords([
        { matchedKeyword: "PRICE", _count: 3 },
        { matchedKeyword: null, _count: 9 },
        { matchedKeyword: "LINK", _count: 7 },
      ])
    ).toEqual([
      { keyword: "LINK", count: 7 },
      { keyword: "PRICE", count: 3 },
    ]);
  });
});

describe("comentários acionados: uma definição só", () => {
  const routes = [
    "app/api/dashboard/stats/route.ts",
    "app/api/heatmap/overview/route.ts",
  ].map((file) => readFileSync(path.resolve(process.cwd(), file), "utf8"));

  it("excludes inbound DMs and link reveals", () => {
    expect(intentCommentFilter.AND.map((clause) => clause.commentId.not.startsWith)).toEqual([
      "dm:",
      "reveal:",
    ]);
  });

  it("keeps both screens on the shared filter instead of local prefix lists", () => {
    for (const source of routes) {
      expect(source).toMatch(/import \{[^}]*intentCommentFilter[^}]*\} from "@\/lib\/tracking\/analytics"/);
      expect(source).not.toMatch(/startsWith: "/);
    }
  });
});
