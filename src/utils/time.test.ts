import { describe, expect, it } from "vitest";
import { formatReset, formatUpdated } from "./time";

describe("formatReset", () => {
  it("formats a relative reset", () => expect(formatReset("2026-01-01T02:14:00.000Z", Date.parse("2026-01-01T00:00:00.000Z"))).toBe("Resets in 2h 14m"));
  it("handles missing and elapsed resets", () => { expect(formatReset(null)).toContain("unavailable"); expect(formatReset("2020-01-01T00:00:00Z", Date.parse("2021-01-01T00:00:00Z"))).toBe("Reset due now"); });
});

describe("formatUpdated", () => {
  it("uses compact relative labels", () => {
    const now = Date.parse("2026-01-01T01:00:00.000Z");
    expect(formatUpdated("2026-01-01T00:59:45.000Z", now)).toBe("just now");
    expect(formatUpdated("2026-01-01T00:48:00.000Z", now)).toBe("12m ago");
  });
});
