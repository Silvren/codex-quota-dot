import { invoke } from "@tauri-apps/api/core";
import type { CodexUsageSnapshot } from "../types/usage";

const mock: CodexUsageSnapshot = {
  schemaVersion: 1, providerId: "mock", plan: "Plus", authenticated: true,
  fiveHour: { remainingPercent: 36, usedPercent: 64, resetsAt: new Date(Date.now() + 2.98 * 3_600_000).toISOString(), resetDurationSeconds: 18_000, health: "warning" },
  weekly: { remainingPercent: 58, usedPercent: 42, resetsAt: new Date(Date.now() + 3.4 * 86_400_000).toISOString(), resetDurationSeconds: 604_800, health: "healthy" },
  availableResets: 1, consumptionState: "consuming", fetchedAt: new Date().toISOString(), lastSuccessfulFetchAt: new Date().toISOString(), isCached: false,
  sourceDescription: "Mock data for browser development only", warnings: ["Browser preview uses mock data. Native builds query Codex app-server."],
};

export async function fetchUsage(): Promise<CodexUsageSnapshot> {
  if (!("__TAURI_INTERNALS__" in window)) {
    const params = new URLSearchParams(window.location.search);
    const requested = Number(params.get("remaining"));
    const remainingPercent = Number.isFinite(requested) && requested >= 0 && requested <= 100
      ? requested
      : mock.fiveHour.remainingPercent;
    const previewWindow = params.get("window");
    const fiveHour = previewWindow === "weekly" || previewWindow === "none"
      ? { ...mock.fiveHour, remainingPercent: null, usedPercent: null, resetsAt: null, health: "unknown" as const }
      : { ...mock.fiveHour, remainingPercent, usedPercent: 100 - (remainingPercent ?? 0) };
    const weekly = previewWindow === "none"
      ? { ...mock.weekly, remainingPercent: null, usedPercent: null, resetsAt: null, health: "unknown" as const }
      : mock.weekly;
    return {
      ...mock,
      fiveHour,
      weekly,
      fetchedAt: new Date().toISOString(),
    };
  }
  return invoke<CodexUsageSnapshot>("get_usage_snapshot");
}
