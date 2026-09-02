import { describe, expect, it } from "vitest";
import { getMeasurementStatus } from "@/lib/crm/results";

const from = new Date("2026-09-01T00:00:00.000Z");
const to = new Date("2026-09-02T00:00:00.000Z");

describe("commercial measurement coverage", () => {
  it("is unavailable without an instrumented event before the period end", () => {
    expect(getMeasurementStatus(null, from, to)).toBe("unavailable");
    expect(getMeasurementStatus(to, from, to)).toBe("unavailable");
  });

  it("is partial when instrumentation starts inside the requested period", () => {
    expect(
      getMeasurementStatus(new Date("2026-09-01T12:00:00.000Z"), from, to)
    ).toBe("partial");
  });

  it("is measured when instrumentation starts at or before the period", () => {
    expect(getMeasurementStatus(from, from, to)).toBe("measured");
    expect(
      getMeasurementStatus(new Date("2026-08-31T23:59:59.999Z"), from, to)
    ).toBe("measured");
  });
});
