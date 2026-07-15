export type HealthState = "healthy" | "warning" | "critical" | "exhausted" | "unknown";
export type ConsumptionState = "idle" | "consuming" | "unknown";

export interface QuotaWindow {
  remainingPercent: number | null;
  usedPercent: number | null;
  resetsAt: string | null;
  resetDurationSeconds: number | null;
  health: HealthState;
}

export interface CodexUsageSnapshot {
  schemaVersion: 1;
  providerId: string;
  plan: string | null;
  fiveHour: QuotaWindow;
  weekly: QuotaWindow;
  availableResets: number | null;
  consumptionState: ConsumptionState;
  authenticated: boolean;
  fetchedAt: string;
  lastSuccessfulFetchAt: string | null;
  isCached: boolean;
  sourceDescription: string;
  warnings: string[];
}
