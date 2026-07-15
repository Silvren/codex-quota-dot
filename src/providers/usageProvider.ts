import { invoke } from "@tauri-apps/api/core";
import type { CodexUsageSnapshot } from "../types/usage";

const mock: CodexUsageSnapshot = {
  schemaVersion: 1, providerId: "mock", plan: "Development preview", authenticated: true,
  fiveHour: { remainingPercent: 72, usedPercent: 28, resetsAt: new Date(Date.now() + 2.2 * 3_600_000).toISOString(), resetDurationSeconds: 18_000, health: "healthy" },
  weekly: { remainingPercent: 38, usedPercent: 62, resetsAt: new Date(Date.now() + 3.4 * 86_400_000).toISOString(), resetDurationSeconds: 604_800, health: "warning" },
  availableResets: 1, consumptionState: "unknown", fetchedAt: new Date().toISOString(), lastSuccessfulFetchAt: new Date().toISOString(), isCached: false,
  sourceDescription: "Mock data for browser development only", warnings: ["Browser preview uses mock data. Native builds query Codex app-server."],
};

export async function fetchUsage(): Promise<CodexUsageSnapshot> {
  if (!("__TAURI_INTERNALS__" in window)) return { ...mock, fetchedAt: new Date().toISOString() };
  return invoke<CodexUsageSnapshot>("get_usage_snapshot");
}
