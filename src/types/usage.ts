export type HealthState = "healthy" | "warning" | "critical" | "exhausted" | "unknown";
export type ConsumptionState = "idle" | "consuming" | "unknown";

export interface QuotaWindow {
  remainingPercent: number | null;
  usedPercent: number | null;
  resetsAt: string | null;
  resetDurationSeconds: number | null;
  health: HealthState;
}

export interface ResetCredit {
  expiresAt: string | null;
}

export interface CreditBalance {
  amount: number | null;
  unlimited: boolean;
}

export interface CodexUsageSnapshot {
  schemaVersion: 1;
  providerId: string;
  plan: string | null;
  fiveHour: QuotaWindow;
  weekly: QuotaWindow;
  windows?: QuotaWindow[]; // Optional only for pre-adaptive cached snapshots.
  creditBalance?: CreditBalance | null;
  availableResets: number | null;
  resetCredits?: ResetCredit[] | null;
  consumptionState: ConsumptionState;
  authenticated: boolean;
  fetchedAt: string;
  lastSuccessfulFetchAt: string | null;
  isCached: boolean;
  sourceDescription: string;
  warnings: string[];
}
