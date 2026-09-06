import type { CodexUsageSnapshot, HealthState, QuotaWindow, ResetCredit } from "../types/usage";

export type DisplayedQuotaWindow = {
  kind: "fiveHour" | "weekly";
  window: QuotaWindow;
};

export function healthForRemaining(value: number | null, warning = 50, critical = 10): HealthState {
  if (value === null || !Number.isFinite(value)) return "unknown";
  if (value <= 0) return "exhausted";
  if (value < critical) return "critical";
  if (value < warning) return "warning";
  return "healthy";
}

function normalizeWindow(value: QuotaWindow, warning: number, critical: number): QuotaWindow {
  const used = Number.isFinite(value.usedPercent) && typeof value.usedPercent === "number" ? Math.min(100, Math.max(0, value.usedPercent)) : null;
  const remaining = Number.isFinite(value.remainingPercent) && typeof value.remainingPercent === "number" ? Math.min(100, Math.max(0, value.remainingPercent)) : used === null ? null : 100 - used;
  return { ...value, usedPercent: used, remainingPercent: remaining, health: healthForRemaining(remaining, warning, critical) };
}

export function normalizeSnapshot(value: CodexUsageSnapshot, warning = 50, critical = 10): CodexUsageSnapshot {
  return { ...value, schemaVersion: 1, fiveHour: normalizeWindow(value.fiveHour, warning, critical), weekly: normalizeWindow(value.weekly, warning, critical), resetCredits: normalizeResetCredits(value.resetCredits), warnings: Array.isArray(value.warnings) ? value.warnings : [] };
}

export function normalizeResetCredits(value: unknown): ResetCredit[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((credit) => credit !== null && typeof credit === "object")
    .map((credit): ResetCredit => ({
      expiresAt: typeof credit.expiresAt === "string" && Number.isFinite(Date.parse(credit.expiresAt)) ? credit.expiresAt : null,
    }))
    .sort((a, b) => (a.expiresAt ? Date.parse(a.expiresAt) : Infinity) - (b.expiresAt ? Date.parse(b.expiresAt) : Infinity));
}

export function selectDisplayedWindow(value: CodexUsageSnapshot): DisplayedQuotaWindow | null {
  if (value.fiveHour.remainingPercent !== null) {
    return { kind: "fiveHour", window: value.fiveHour };
  }
  if (value.weekly.remainingPercent !== null) {
    return { kind: "weekly", window: value.weekly };
  }
  return null;
}

export function inferConsumption(previous: CodexUsageSnapshot | null, current: CodexUsageSnapshot): CodexUsageSnapshot["consumptionState"] {
  if (!previous || previous.providerId !== current.providerId || previous.plan !== current.plan
    || !previous.authenticated || !current.authenticated || previous.isCached || current.isCached) return "unknown";
  let comparable = false;
  const changed = (["fiveHour", "weekly"] as const).some((key) => {
    const before = previous[key].remainingPercent;
    const after = current[key].remainingPercent;
    if (before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after)
      || previous[key].resetsAt !== current[key].resetsAt) return false;
    comparable = true;
    return after < before;
  });
  return changed ? "consuming" : comparable ? "idle" : "unknown";
}
