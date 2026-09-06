import { invoke } from "@tauri-apps/api/core";
import type { CodexUsageSnapshot } from "../types/usage";

const mock: CodexUsageSnapshot = {
  schemaVersion: 1, providerId: "mock", plan: "Plus", authenticated: true,
  fiveHour: { remainingPercent: 36, usedPercent: 64, resetsAt: new Date(Date.now() + 2.98 * 3_600_000).toISOString(), resetDurationSeconds: 18_000, health: "warning" },
  weekly: { remainingPercent: 58, usedPercent: 42, resetsAt: new Date(Date.now() + 3.4 * 86_400_000).toISOString(), resetDurationSeconds: 604_800, health: "healthy" },
  availableResets: 1, consumptionState: "consuming", fetchedAt: new Date().toISOString(), lastSuccessfulFetchAt: new Date().toISOString(), isCached: false,
  resetCredits: [{ expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }],
  sourceDescription: "Mock data for browser development only", warnings: ["Browser preview uses mock data. Native builds query Codex app-server."],
};

export async function fetchUsage(): Promise<CodexUsageSnapshot> {
  if (!("__TAURI_INTERNALS__" in window)) {
    const params = new URLSearchParams(window.location.search);
    const rawRemaining = params.get("remaining");
    const requested = rawRemaining?.trim() ? Number(rawRemaining) : NaN;
    const remainingPercent = Number.isFinite(requested) && requested >= 0 && requested <= 100
      ? requested
      : mock.fiveHour.remainingPercent;
    const previewWindow = params.get("window");
    const previewActivity = params.get("activity");
    if (params.get("error") === "1") throw new Error("Preview: usage unavailable");
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
      consumptionState: previewActivity === "idle" || previewActivity === "unknown" ? previewActivity : mock.consumptionState,
      authenticated: params.get("auth") !== "0",
      isCached: params.get("cached") === "1",
      ...(params.get("resetDetails") === "missing" ? { resetCredits: null }
        : params.get("resetDetails") === "two" ? { availableResets: 2, resetCredits: [
          { expiresAt: "2026-10-04T23:14:12Z" }, { expiresAt: "2026-10-04T05:25:36Z" },
        ] } : params.get("resetDetails") === "empty" ? { availableResets: 0, resetCredits: [] } : {}),
      fetchedAt: new Date().toISOString(),
    };
  }
  return invoke<CodexUsageSnapshot>("get_usage_snapshot");
}
