import type { CodexUsageSnapshot, HealthState, QuotaWindow } from "../types/usage";

export type DisplayedQuotaWindow = {
  kind: "fiveHour" | "weekly";
  window: QuotaWindow;
};

export function healthForRemaining(value: number | null, warning = 50, critical = 20): HealthState {
  if (value === null || !Number.isFinite(value)) return "unknown";
  if (value <= 0) return "exhausted";
  if (value < critical) return "critical";
  if (value <= warning) return "warning";
  return "healthy";
}

function normalizeWindow(value: QuotaWindow, warning: number, critical: number): QuotaWindow {
  const used = typeof value.usedPercent === "number" ? Math.min(100, Math.max(0, value.usedPercent)) : null;
  const remaining = typeof value.remainingPercent === "number" ? Math.min(100, Math.max(0, value.remainingPercent)) : used === null ? null : 100 - used;
  return { ...value, usedPercent: used, remainingPercent: remaining, health: healthForRemaining(remaining, warning, critical) };
}

export function normalizeSnapshot(value: CodexUsageSnapshot, warning = 50, critical = 20): CodexUsageSnapshot {
  return { ...value, schemaVersion: 1, fiveHour: normalizeWindow(value.fiveHour, warning, critical), weekly: normalizeWindow(value.weekly, warning, critical), warnings: Array.isArray(value.warnings) ? value.warnings : [] };
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
  if (!previous || previous.providerId !== current.providerId) return "unknown";
  const changed = (["fiveHour", "weekly"] as const).some((key) => {
    const before = previous[key].remainingPercent;
    const after = current[key].remainingPercent;
    return before !== null && after !== null && after < before;
  });
  return changed ? "consuming" : "idle";
}
