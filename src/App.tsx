import { useCallback, useEffect, useRef, useState } from "react";
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import "./App.css";
import { fetchUsage } from "./providers/usageProvider";
import type { CodexUsageSnapshot, HealthState, QuotaWindow } from "./types/usage";
import { inferConsumption, normalizeSnapshot } from "./utils/usage";
import { formatReset, formatTimestamp, formatUpdated } from "./utils/time";

const COLLAPSED = 20;
const EXPANDED_WIDTH = 280;
const EXPANDED_HEIGHT = 286;
const CACHE_KEY = "codex-quota-dot:snapshot:v1";
const SETTINGS_KEY = "codex-quota-dot:settings:v2";
const POSITION_KEY = "codex-quota-dot:position";

type Theme = "system" | "light" | "dark";
type Settings = { theme: Theme; refreshSeconds: 0 | 30 | 60 | 300 };
const DEFAULT_SETTINGS: Settings = { theme: "system", refreshSeconds: 60 };
const UNKNOWN_WINDOW: QuotaWindow = {
  remainingPercent: null,
  usedPercent: null,
  resetsAt: null,
  resetDurationSeconds: null,
  health: "unknown",
};

function readSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    const theme: Theme = stored.theme === "light" || stored.theme === "dark" ? stored.theme : "system";
    const refreshSeconds = [0, 30, 60, 300].includes(stored.refreshSeconds ?? -1)
      ? stored.refreshSeconds as Settings["refreshSeconds"]
      : DEFAULT_SETTINGS.refreshSeconds;
    return { theme, refreshSeconds };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readCached(): CodexUsageSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalizeSnapshot({ ...JSON.parse(raw), isCached: true }) : null;
  } catch {
    return null;
  }
}

function formatPlan(plan: string | null | undefined): string {
  if (!plan) return "Codex";
  return `Codex ${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
}

function healthText(health: HealthState, snapshot: CodexUsageSnapshot | null, error: string | null): string {
  if (!snapshot?.authenticated) return "Login not detected";
  if (error || snapshot.isCached) return "Last known usage";
  switch (health) {
    case "healthy": return "Usage healthy";
    case "warning": return "Usage running low";
    case "critical": return "Usage critical";
    case "exhausted": return "Usage depleted";
    default: return "Usage unavailable";
  }
}

function QuotaRow({ label, value }: { label: string; value: QuotaWindow }) {
  const remaining = value.remainingPercent;
  return (
    <section className="quota-row" aria-label={`${label} quota`}>
      <div className="quota-heading">
        <span>{label}</span>
        <strong>{remaining === null ? "—" : `${Math.round(remaining)}%`}</strong>
      </div>
      <div className="quota-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining ?? undefined}>
        <span className={`quota-fill ${value.health}`} style={{ width: `${remaining ?? 0}%` }} />
      </div>
      <p title={value.resetsAt ? formatTimestamp(value.resetsAt) : undefined}>{formatReset(value.resetsAt)}</p>
    </section>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 2.8v1.4M10 15.8v1.4M2.8 10h1.4M15.8 10h1.4M4.9 4.9l1 1M14.1 14.1l1 1M15.1 4.9l-1 1M5.9 14.1l-1 1" />
      <circle cx="10" cy="10" r="5.7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.4 7.1A6 6 0 1 0 16 11" />
      <path d="M12.5 4.7l3.2 2.1-2.2 3" />
    </svg>
  );
}

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => readSettings());
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<CodexUsageSnapshot | null>(() => readCached());
  const [error, setError] = useState<string | null>(null);
  const previous = useRef<CodexUsageSnapshot | null>(null);
  const refreshingRef = useRef(false);
  const edgeAnchor = useRef({ right: false, bottom: false });
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const health: HealthState = snapshot
    ? [snapshot.fiveHour.health, snapshot.weekly.health].sort(
        (a, b) => ["exhausted", "critical", "warning", "unknown", "healthy"].indexOf(a) - ["exhausted", "critical", "warning", "unknown", "healthy"].indexOf(b),
      )[0]
    : "unknown";

  const resizeNative = useCallback(async (nextExpanded: boolean) => {
    try {
      const win = getCurrentWindow();
      const [monitor, position, currentSize] = await Promise.all([currentMonitor(), win.outerPosition(), win.outerSize()]);
      if (!monitor) {
        await win.setSize(new LogicalSize(nextExpanded ? EXPANDED_WIDTH : COLLAPSED, nextExpanded ? EXPANDED_HEIGHT : COLLAPSED));
        return;
      }
      const currentRight = monitor.position.x + monitor.size.width - currentSize.width;
      const currentBottom = monitor.position.y + monitor.size.height - currentSize.height;
      const threshold = Math.round(14 * monitor.scaleFactor);
      if (nextExpanded) {
        edgeAnchor.current = {
          right: Math.abs(position.x - currentRight) <= threshold,
          bottom: Math.abs(position.y - currentBottom) <= threshold,
        };
      }
      const width = Math.round((nextExpanded ? EXPANDED_WIDTH : COLLAPSED) * monitor.scaleFactor);
      const height = Math.round((nextExpanded ? EXPANDED_HEIGHT : COLLAPSED) * monitor.scaleFactor);
      const maxX = monitor.position.x + monitor.size.width - width;
      const maxY = monitor.position.y + monitor.size.height - height;
      const x = edgeAnchor.current.right ? maxX : Math.max(monitor.position.x, Math.min(position.x, maxX));
      const y = edgeAnchor.current.bottom ? maxY : Math.max(monitor.position.y, Math.min(position.y, maxY));
      await win.setSize(new LogicalSize(nextExpanded ? EXPANDED_WIDTH : COLLAPSED, nextExpanded ? EXPANDED_HEIGHT : COLLAPSED));
      await win.setPosition(new PhysicalPosition(x, y));
    } catch {
      // Browser preview has no native window.
    }
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setClosing(false);
    if (!expanded) {
      setExpanded(true);
      void resizeNative(true);
    }
  }, [expanded, resizeNative]);

  const closePanel = useCallback((force = false) => {
    if (pinned && !force) return;
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setClosing(false);
      setSettingsOpen(false);
      void resizeNative(false);
    }, 140);
  }, [pinned, resizeNative]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError(null);
    try {
      const next = normalizeSnapshot(await fetchUsage());
      next.consumptionState = inferConsumption(previous.current, next);
      previous.current = next;
      setSnapshot(next);
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read Codex usage");
      setSnapshot((current) => current ? { ...current, isCached: true } : current);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = settings.refreshSeconds ? window.setInterval(() => void refresh(), settings.refreshSeconds * 1000) : null;
    return () => {
      window.clearTimeout(initial);
      if (interval !== null) window.clearInterval(interval);
    };
  }, [refresh, settings.refreshSeconds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (settingsOpen) setSettingsOpen(false);
      else {
        setPinned(false);
        closePanel(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, settingsOpen]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const win = getCurrentWindow();
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null") as { x: number; y: number } | null;
      if (saved) void win.setPosition(new PhysicalPosition(saved.x, saved.y));
    } catch {
      // Ignore invalid position state.
    }

    let snapTimer: number | null = null;
    const unlisten = win.onMoved(({ payload: position }) => {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(async () => {
        try {
          const [monitor, size] = await Promise.all([currentMonitor(), win.outerSize()]);
          if (!monitor) return;
          const threshold = Math.round(12 * monitor.scaleFactor);
          const left = monitor.position.x;
          const top = monitor.position.y;
          const right = left + monitor.size.width - size.width;
          const bottom = top + monitor.size.height - size.height;
          const x = Math.abs(position.x - left) <= threshold ? left : Math.abs(position.x - right) <= threshold ? right : position.x;
          const y = Math.abs(position.y - top) <= threshold ? top : Math.abs(position.y - bottom) <= threshold ? bottom : position.y;
          if (x !== position.x || y !== position.y) await win.setPosition(new PhysicalPosition(x, y));
        } catch {
          // A monitor may disappear while moving.
        }
      }, 180);
    });
    return () => {
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      void unlisten.then((stop) => stop());
    };
  }, []);

  const enter = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    if (expanded || openTimer.current !== null) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      openPanel();
    }, 150);
  };

  const leave = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (pinned) return;
    closeTimer.current = window.setTimeout(() => closePanel(), 450);
  };

  const drag = async () => {
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Browser preview.
    }
  };

  const resetPosition = async () => {
    try {
      const monitor = await currentMonitor();
      if (!monitor) return;
      const margin = Math.round(16 * monitor.scaleFactor);
      const width = Math.round(EXPANDED_WIDTH * monitor.scaleFactor);
      await getCurrentWindow().setPosition(new PhysicalPosition(
        monitor.position.x + monitor.size.width - width - margin,
        monitor.position.y + margin,
      ));
      setSettingsOpen(false);
    } catch {
      // Browser preview.
    }
  };

  if (!expanded) {
    return (
      <main className="dot-shell" onMouseEnter={enter} onMouseLeave={leave} onMouseDown={(event) => event.button === 0 && void drag()}>
        <button
          className={`quota-dot ${health}`}
          aria-label={`Codex quota: ${health}. Hover to expand; click to keep open.`}
          onClick={() => { setPinned(true); openPanel(); }}
        >
          <span className={`dot-state ${health}`} aria-hidden="true" />
        </button>
      </main>
    );
  }

  const activity = snapshot?.consumptionState ?? "unknown";
  const status = healthText(health, snapshot, error);

  return (
    <main className={`panel ${closing ? "closing" : ""}`} onMouseEnter={enter} onMouseLeave={leave} title={error ?? undefined}>
      <header className="panel-header" onMouseDown={(event) => event.button === 0 && void drag()}>
        <div className="account-state">
          <strong>{formatPlan(snapshot?.plan)}</strong>
          <span><i className={`status-dot ${health}`} aria-hidden="true" />{status}</span>
        </div>
        <button
          className={`icon-button settings-trigger ${settingsOpen ? "active" : ""}`}
          aria-label="Settings"
          aria-expanded={settingsOpen}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <GearIcon />
        </button>
      </header>

      <div className="quota-list">
        <QuotaRow label="5-hour" value={snapshot?.fiveHour ?? UNKNOWN_WINDOW} />
        <QuotaRow label="Weekly" value={snapshot?.weekly ?? UNKNOWN_WINDOW} />
      </div>

      <footer className="panel-footer">
        <span className="updated-line">
          <b>{activity.charAt(0).toUpperCase() + activity.slice(1)}</b>
          <i aria-hidden="true">·</i>
          {snapshot ? `${snapshot.isCached ? "Cached" : "Updated"} ${formatUpdated(snapshot.fetchedAt)}` : "Not updated"}
        </span>
        <button className={`icon-button refresh-button ${refreshing ? "refreshing" : ""}`} onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh usage">
          <RefreshIcon />
        </button>
      </footer>

      {settingsOpen && (
        <section className="settings-popover" aria-label="Settings">
          <label>
            <span>Theme</span>
            <select value={settings.theme} onChange={(event) => setSettings((current) => ({ ...current, theme: event.target.value as Theme }))}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            <span>Refresh</span>
            <select value={settings.refreshSeconds} onChange={(event) => setSettings((current) => ({ ...current, refreshSeconds: Number(event.target.value) as Settings["refreshSeconds"] }))}>
              <option value={30}>30 sec</option>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={0}>Manual</option>
            </select>
          </label>
          <button onClick={() => void resetPosition()}>Reset position</button>
        </section>
      )}
    </main>
  );
}
