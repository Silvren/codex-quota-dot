import { describe, expect, it } from "vitest";
import { formatCreditBalance, normalizeCreditBalance, availableWindows, quotaLabel, healthForRemaining, inferConsumption, normalizeSnapshot, normalizeResetCredits } from "./usage";
import type { CodexUsageSnapshot } from "../types/usage";

const snapshot = (remaining: number): CodexUsageSnapshot => ({
  schemaVersion: 1, providerId: "test", plan: "plus", authenticated: true, availableResets: null, consumptionState: "unknown",
  fetchedAt: new Date().toISOString(), lastSuccessfulFetchAt: null, isCached: false, sourceDescription: "test", warnings: [],
  fiveHour: { remainingPercent: remaining, usedPercent: 100 - remaining, resetsAt: null, resetDurationSeconds: null, health: "unknown" },
  weekly: { remainingPercent: remaining, usedPercent: 100 - remaining, resetsAt: null, resetDurationSeconds: null, health: "unknown" },
});

const selectDisplayedWindow = (value: CodexUsageSnapshot) => availableWindows(value)[0] ?? null;

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


describe("adaptive quota windows", () => {
  const window = (minutes: number | null, remaining = 70) => ({
    ...snapshot(remaining).fiveHour, resetDurationSeconds: minutes === null ? null : minutes * 60,
  });
  it.each(["plus", "pro", "pro_5x", "business"])("supports weekly-only %s accounts", (plan) => {
    const value = { ...snapshot(99), plan, windows: [window(10080)] };
    expect(availableWindows(value)).toHaveLength(1);
    expect(selectDisplayedWindow(value)?.kind).toBe("weekly");
    expect(selectDisplayedWindow(value)?.window.remainingPercent).toBe(70);
  });
  it("sorts actual periods, not primary/secondary role, without modifying input", () => {
    const windows = [window(10080), window(1440, 45)];
    const value = { ...snapshot(99), windows };
    expect(availableWindows(value).map((item) => item.window.remainingPercent)).toEqual([45, 70]);
    expect(windows[0].resetDurationSeconds).toBe(604800);
    expect(quotaLabel(selectDisplayedWindow(value)!, "zh")).toBe("1 天剩余");
  });
  it("does not restore legacy percentages or invent unlimited quota for an empty list", () => {
    const value = normalizeSnapshot({ ...snapshot(100), plan: "pro", windows: [] });
    expect(selectDisplayedWindow(value)).toBeNull();
  });
  it("keeps exhausted quota and skips missing percentages", () => {
    const value = normalizeSnapshot({ ...snapshot(99), windows: [
      { ...window(300), remainingPercent: null, usedPercent: null }, window(10080, 0),
    ] });
    expect(selectDisplayedWindow(value)?.window.remainingPercent).toBe(0);
    expect(selectDisplayedWindow(value)?.kind).toBe("weekly");
  });
  it("can display a window with no reported duration without guessing five hours", () => {
    const value = { ...snapshot(99), windows: [window(null)] };
    expect(quotaLabel(selectDisplayedWindow(value)!, "zh")).toBe("周期剩余");
    expect(quotaLabel(selectDisplayedWindow(value)!, "en")).toBe("Quota remaining");
  });
  it.each([[300, "5 小时剩余", "5-hour remaining"], [120, "2 小时剩余", "2-hour remaining"],
    [90, "90 分钟剩余", "90-minute remaining"], [10080, "本周剩余", "Weekly remaining"]])(
    "labels a %s-minute window accurately", (minutes, zh, en) => {
      const selected = selectDisplayedWindow({ ...snapshot(99), windows: [window(minutes as number)] })!;
      expect(quotaLabel(selected, "zh")).toBe(zh);
      expect(quotaLabel(selected, "en")).toBe(en);
    });
  it("normalizes invalid durations and non-finite percentages", () => {
    const value = normalizeSnapshot({ ...snapshot(99), windows: [window(-1), window(300, NaN)] });
    expect(value.windows?.[0].resetDurationSeconds).toBeNull();
    expect(availableWindows(value)).toHaveLength(1);
  });
  it("infers consumption from weekly-only and custom periods", () => {
    for (const minutes of [10080, 1440]) {
      expect(inferConsumption({ ...snapshot(99), windows: [window(minutes, 70)] },
        { ...snapshot(99), windows: [window(minutes, 69)] })).toBe("consuming");
    }
  });
  it("does not compare unrelated periods or unknown periods", () => {
    expect(inferConsumption({ ...snapshot(99), windows: [window(300, 70)] },
      { ...snapshot(99), windows: [window(1440, 69)] })).toBe("unknown");
    expect(inferConsumption({ ...snapshot(99), windows: [window(null, 70)] },
      { ...snapshot(99), windows: [window(null, 69)] })).toBe("unknown");
  });
  it("does not report old five-hour consumption when the next snapshot is weekly-only", () => {
    expect(inferConsumption({ ...snapshot(70), windows: [window(300, 70), window(10080, 69)] },
      { ...snapshot(60), windows: [window(10080, 69)] })).toBe("idle");
  });
});

describe("credit balance", () => {
  it("supports old cached snapshots", () => expect(normalizeSnapshot(snapshot(80)).creditBalance).toBeNull());
  it.each([NaN, Infinity, -1])("rejects invalid balance %s", (amount) => {
    expect(normalizeCreditBalance({ amount, unlimited: false })?.amount).toBeNull();
  });
  it("does not confuse credits with dollars or reset credits", () => {
    expect(formatCreditBalance({ amount: 298.861599, unlimited: false }, "zh")).toBe("298.86 credits");
    expect(formatCreditBalance({ amount: 0, unlimited: false }, "en")).toBe("0 credits");
  });
  it("distinguishes missing from unlimited", () => {
    expect(formatCreditBalance(null, "zh")).toBe("—");
    expect(formatCreditBalance({ amount: null, unlimited: true }, "zh")).toBe("不限额");
    expect(formatCreditBalance({ amount: null, unlimited: true }, "en")).toBe("Unlimited");
  });
  it("keeps large balances compact", () => {
    expect(formatCreditBalance({ amount: 123456789, unlimited: false }, "en")).toBe("123.46M credits");
  });
  it("does not round a positive tiny balance down to zero", () => {
    expect(formatCreditBalance({ amount: 0.001, unlimited: false }, "en")).toBe("<0.01 credits");
  });
});
