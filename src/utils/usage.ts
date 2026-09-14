import type { CodexUsageSnapshot, CreditBalance, HealthState, QuotaWindow, ResetCredit } from "../types/usage";

export type DisplayedQuotaWindow = {
  kind: "fiveHour" | "weekly" | "custom";
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
  return { ...value, resetDurationSeconds: typeof value.resetDurationSeconds === "number" && Number.isFinite(value.resetDurationSeconds) && value.resetDurationSeconds > 0 ? value.resetDurationSeconds : null, usedPercent: used, remainingPercent: remaining, health: healthForRemaining(remaining, warning, critical) };
}

export function normalizeSnapshot(value: CodexUsageSnapshot, warning = 50, critical = 10): CodexUsageSnapshot {
  return {
    ...value,
    schemaVersion: 1,
    fiveHour: normalizeWindow(value.fiveHour, warning, critical),
    weekly: normalizeWindow(value.weekly, warning, critical),
    windows: Array.isArray(value.windows)
      ? value.windows.filter((window) => window !== null && typeof window === "object")
        .map((window) => normalizeWindow(window, warning, critical))
      : undefined,
    creditBalance: normalizeCreditBalance(value.creditBalance),
    resetCredits: normalizeResetCredits(value.resetCredits),
    warnings: Array.isArray(value.warnings) ? value.warnings : [],
  };
}

export function normalizeCreditBalance(value: CreditBalance | null | undefined): CreditBalance | null {
  if (!value || typeof value !== "object") return null;
  return {
    amount: typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount >= 0 ? value.amount : null,
    unlimited: value.unlimited === true,
  };
}

export function formatCreditBalance(value: CreditBalance | null | undefined, language: "zh" | "en"): string {
  const balance = normalizeCreditBalance(value);
  if (balance?.unlimited) return language === "zh" ? "不限额" : "Unlimited";
  if (balance?.amount == null) return "—";
  if (balance.amount > 0 && balance.amount < 0.01) return "<0.01 credits";
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 2,
    notation: balance.amount >= 1_000_000 ? "compact" : "standard",
  }).format(balance.amount) + " credits";
}

export function normalizeResetCredits(value: unknown): ResetCredit[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((credit) => credit !== null && typeof credit === "object")
    .map((credit): ResetCredit => ({
      expiresAt: typeof credit.expiresAt === "string" && Number.isFinite(Date.parse(credit.expiresAt)) ? credit.expiresAt : null,
    }))
    .sort((a, b) => (a.expiresAt ? Date.parse(a.expiresAt) : Infinity) - (b.expiresAt ? Date.parse(b.expiresAt) : Infinity));
}

export function availableWindows(value: CodexUsageSnapshot): DisplayedQuotaWindow[] {
  // An explicit empty list is authoritative: never resurrect an obsolete cached window.
  const windows = value.windows ?? [
    { ...value.fiveHour, resetDurationSeconds: value.fiveHour.resetDurationSeconds ?? 18_000 },
    { ...value.weekly, resetDurationSeconds: value.weekly.resetDurationSeconds ?? 604_800 },
  ];
  return windows
    .filter((window) => window.remainingPercent !== null && Number.isFinite(window.remainingPercent))
    .map((window): DisplayedQuotaWindow => ({
      kind: window.resetDurationSeconds === 604_800 ? "weekly" : window.resetDurationSeconds === 18_000 ? "fiveHour" : "custom",
      window,
    }))
    .sort((a, b) => (a.window.resetDurationSeconds ?? Infinity) - (b.window.resetDurationSeconds ?? Infinity));
}

export function quotaLabel(value: DisplayedQuotaWindow, language: "zh" | "en"): string {
  if (value.kind === "weekly") return language === "zh" ? "本周剩余" : "Weekly remaining";
  const seconds = value.window.resetDurationSeconds;
  if (!seconds) return language === "zh" ? "周期剩余" : "Quota remaining";
  const unit = seconds % 86_400 === 0 ? 86_400 : seconds % 3_600 === 0 ? 3_600 : 60;
  const amount = Math.round(seconds / unit * 10) / 10;
  const label = language === "zh" ? (unit === 86_400 ? "天" : unit === 3_600 ? "小时" : "分钟")
    : (unit === 86_400 ? "day" : unit === 3_600 ? "hour" : "minute");
  return language === "zh" ? `${amount} ${label}剩余` : `${amount}-${label} remaining`;
}

export function inferConsumption(previous: CodexUsageSnapshot | null, current: CodexUsageSnapshot): CodexUsageSnapshot["consumptionState"] {
  if (!previous || previous.providerId !== current.providerId || previous.plan !== current.plan
    || !previous.authenticated || !current.authenticated || previous.isCached || current.isCached) return "unknown";
  let comparable = false;
  const beforeWindows = availableWindows(previous);
  const changed = availableWindows(current).some(({ window: after }) => {
    if (!after.resetDurationSeconds) return false;
    const matches = beforeWindows.filter(({ window: before }) => before.resetDurationSeconds === after.resetDurationSeconds
      && before.resetsAt === after.resetsAt);
    if (matches.length !== 1) return false;
    comparable = true;
    return after.remainingPercent! < matches[0].window.remainingPercent!;
  });
  return changed ? "consuming" : comparable ? "idle" : "unknown";
}
