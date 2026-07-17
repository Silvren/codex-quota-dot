import { describe, expect, it } from "vitest";
import { healthForRemaining, inferConsumption, normalizeSnapshot, selectDisplayedWindow } from "./usage";
import type { CodexUsageSnapshot } from "../types/usage";

const snapshot = (remaining: number): CodexUsageSnapshot => ({
  schemaVersion: 1, providerId: "test", plan: "plus", authenticated: true, availableResets: null, consumptionState: "unknown",
  fetchedAt: new Date().toISOString(), lastSuccessfulFetchAt: null, isCached: false, sourceDescription: "test", warnings: [],
  fiveHour: { remainingPercent: remaining, usedPercent: 100 - remaining, resetsAt: null, resetDurationSeconds: null, health: "unknown" },
  weekly: { remainingPercent: remaining, usedPercent: 100 - remaining, resetsAt: null, resetDurationSeconds: null, health: "unknown" },
});

describe("healthForRemaining", () => {
  it.each([[null,"unknown"],[0,"exhausted"],[19.9,"critical"],[20,"warning"],[50,"warning"],[50.1,"healthy"]])("maps %s to %s", (value, expected) => expect(healthForRemaining(value as number | null)).toBe(expected));
});

describe("inferConsumption", () => {
  it("detects a quota drop", () => expect(inferConsumption(snapshot(80), snapshot(79))).toBe("consuming"));
  it("reports idle when quota is unchanged", () => expect(inferConsumption(snapshot(80), snapshot(80))).toBe("idle"));
  it("is unknown without history", () => expect(inferConsumption(null, snapshot(80))).toBe("unknown"));
});

describe("custom thresholds", () => {
  it("recomputes health without mutating percentages", () => {
    expect(normalizeSnapshot(snapshot(65), 70, 40).fiveHour.health).toBe("warning");
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
