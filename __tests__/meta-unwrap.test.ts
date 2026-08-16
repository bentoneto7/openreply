import { describe, expect, it } from "vitest";
import { unwrapSingle } from "@/lib/meta/client";

describe("unwrapSingle", () => {
  it("unwraps the Business Login envelope the code exchange returns", () => {
    const payload = {
      data: [{ access_token: "IGAA123", user_id: "17841400000000000" }],
    };
    expect(unwrapSingle<{ access_token: string }>(payload).access_token).toBe(
      "IGAA123"
    );
  });

  it("passes a bare object through untouched", () => {
    const payload = { access_token: "IGAA123", expires_in: 5184000 };
    expect(unwrapSingle(payload)).toBe(payload);
  });

  // The same `data` key means "list" on media/comments endpoints. Unwrapping
  // those would silently hand back the first item as if it were the whole
  // response, so only a single-element envelope may be unwrapped.
  it("leaves multi-item collections alone", () => {
    const payload = { data: [{ id: "1" }, { id: "2" }] };
    expect(unwrapSingle(payload)).toBe(payload);
  });

  it("leaves an empty collection alone", () => {
    const payload = { data: [] };
    expect(unwrapSingle(payload)).toBe(payload);
  });

  it("survives null and non-object payloads", () => {
    expect(unwrapSingle(null)).toBeNull();
    expect(unwrapSingle("nope")).toBe("nope");
  });
});
