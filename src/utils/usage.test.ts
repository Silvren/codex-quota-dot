import { describe, expect, it } from "vitest";
import { healthForRemaining, inferConsumption, normalizeSnapshot, normalizeResetCredits, selectDisplayedWindow } from "./usage";
import type { CodexUsageSnapshot } from "../types/usage";

const snapshot = (remaining: number): CodexUsageSnapshot => ({
  schemaVersion: 1, providerId: "test", plan: "plus", authenticated: true, availableResets: null, consumptionState: "unknown",
  fetchedAt: new Date().toISOString(), lastSuccessfulFetchAt: null, isCached: false, sourceDescription: "test", warnings: [],
  fiveHour: { remainingPercent: remaining, usedPercent: 100 - remaining, resetsAt: null, resetDurationSeconds: null, health: "unknown" },
  weekly: { remainingPercent: remaining, usedPercent: 100 - remaining, resetsAt: null, resetDurationSeconds: null, health: "unknown" },
});

describe("healthForRemaining", () => {
  it.each([[null,"unknown"],[0,"exhausted"],[9.9,"critical"],[10,"warning"],[49.9,"warning"],[50,"healthy"],[NaN,"unknown"]])("maps %s to %s", (value, expected) => expect(healthForRemaining(value as number | null)).toBe(expected));
});

describe("reset credit details", () => {
  it("supports old cached snapshots without expiration fields", () => {
    expect(normalizeSnapshot(snapshot(80)).resetCredits).toBeNull();
  });
  it("sorts known expirations first without modifying the source", () => {
    const input = [{ expiresAt: null }, { expiresAt: "2026-10-05T00:54:12Z" }, { expiresAt: "2026-10-04T07:05:36Z" }];
    expect(normalizeResetCredits(input)).toEqual([input[2], input[1], input[0]]);
    expect(input[0].expiresAt).toBeNull();
  });
  it("keeps invalid expiration values unknown rather than inventing dates", () => {
    expect(normalizeResetCredits([null, { expiresAt: "invalid" }, { expiresAt: 1791091536 }, {}]))
      .toEqual([{ expiresAt: null }, { expiresAt: null }, { expiresAt: null }]);
  });
  it("distinguishes absent details from an empty list", () => {
    expect(normalizeResetCredits(null)).toBeNull();
    expect(normalizeResetCredits([])).toEqual([]);
  });
});

describe("inferConsumption", () => {
  it("detects a quota drop", () => expect(inferConsumption(snapshot(80), snapshot(79))).toBe("consuming"));
  it("reports idle when quota is unchanged", () => expect(inferConsumption(snapshot(80), snapshot(80))).toBe("idle"));
  it("is unknown without history", () => expect(inferConsumption(null, snapshot(80))).toBe("unknown"));
  it("does not infer idle without comparable windows", () => {
    const empty = snapshot(80);
    empty.fiveHour.remainingPercent = null;
    empty.weekly.remainingPercent = null;
    expect(inferConsumption(empty, empty)).toBe("unknown");
  });
  it("does not infer consumption across resets or cached data", () => {
    const before = snapshot(80);
    const after = snapshot(79);
    after.fiveHour.resetsAt = "2026-09-06T00:00:00Z";
    after.weekly.resetsAt = "2026-09-10T00:00:00Z";
    expect(inferConsumption(before, after)).toBe("unknown");
    after.isCached = true;
    expect(inferConsumption(before, after)).toBe("unknown");
  });
});

describe("custom thresholds", () => {
  it("recomputes health without mutating percentages", () => {
    expect(normalizeSnapshot(snapshot(65), 70, 40).fiveHour.health).toBe("warning");
  });
  it("rejects non-finite values and falls back to a valid used percentage", () => {
    const value = snapshot(NaN);
    expect(normalizeSnapshot(value).fiveHour.remainingPercent).toBeNull();
    value.fiveHour.usedPercent = 20;
    expect(normalizeSnapshot(value).fiveHour.remainingPercent).toBe(80);
    value.weekly.remainingPercent = Infinity;
    expect(normalizeSnapshot(value).weekly.remainingPercent).toBeNull();
  });
});

describe("selectDisplayedWindow", () => {
  it("prefers the short quota window when it is available", () => {
    expect(selectDisplayedWindow(snapshot(65))?.kind).toBe("fiveHour");
  });

  it("falls back to the weekly window when Codex omits the short window", () => {
    const value = snapshot(65);
    value.fiveHour.remainingPercent = null;
    value.fiveHour.usedPercent = null;
    expect(selectDisplayedWindow(value)?.kind).toBe("weekly");
  });

  it("returns no display window when Codex supplies neither quota", () => {
    const value = snapshot(65);
    value.fiveHour.remainingPercent = null;
    value.weekly.remainingPercent = null;
    expect(selectDisplayedWindow(value)).toBeNull();
  });
});
