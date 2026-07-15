import { useCallback, useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import codexMark from "./assets/codex-mark.svg";
import "./App.css";
import { fetchUsage } from "./providers/usageProvider";
import type { CodexUsageSnapshot } from "./types/usage";
import { inferConsumption, normalizeSnapshot } from "./utils/usage";

const COLLAPSED = 100;
const EXPANDED = 320;
const CACHE_KEY = "codex-quota-dot:snapshot:v1";
const SETTINGS_KEY = "codex-quota-dot:settings:v3";
const POSITION_KEY = "codex-quota-dot:position";

type Language = "zh" | "en";
type Settings = { language: Language; refreshSeconds: 0 | 30 | 60 | 300 };
type VisualTier = "healthy" | "caution" | "critical" | "unknown";

const DEFAULT_SETTINGS: Settings = { language: "zh", refreshSeconds: 60 };

const copy = {
  zh: {
    fiveHour: "5 小时剩余",
    weekly: "本周剩余",
    until: "至",
    resetCredit: "次重置机会",
    resetCredits: "次重置机会",
    view: "查看",
    unavailable: "暂无额度数据",
    resetUnknown: "重置时间未知",
    resetNow: "即将重置",
    resetIn: "后重置",
    refresh: "刷新额度",
    language: "Switch to English",
    pinOn: "取消窗口置顶",
    pinOff: "窗口置顶",
    creditUnavailable: "当前数据源未提供重置机会到期时间。",
  },
  en: {
    fiveHour: "5-hour remaining",
    weekly: "Weekly remaining",
    until: "until",
    resetCredit: " reset credit",
    resetCredits: " reset credits",
    view: "View",
    unavailable: "Quota unavailable",
    resetUnknown: "reset time unavailable",
    resetNow: "resets now",
    resetIn: "until reset",
    refresh: "Refresh usage",
    language: "切换到中文",
    pinOn: "Disable always on top",
    pinOff: "Keep window on top",
    creditUnavailable: "The current provider did not supply reset-credit expiration times.",
  },
} as const;

function readSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    const language = stored.language === "en" ? "en" : "zh";
    const refreshSeconds = [0, 30, 60, 300].includes(stored.refreshSeconds ?? -1)
      ? stored.refreshSeconds as Settings["refreshSeconds"]
      : DEFAULT_SETTINGS.refreshSeconds;
    return { language, refreshSeconds };
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

function visualTier(remaining: number | null | undefined): VisualTier {
  if (remaining === null || remaining === undefined) return "unknown";
  if (remaining < 10) return "critical";
  if (remaining < 50) return "caution";
  return "healthy";
}

function planLabel(plan: string | null | undefined): string {
  return `CODEX · ${(plan || "PLUS").toUpperCase()}`;
}

function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value)}`;
}

function resetLabel(iso: string | null | undefined, language: Language): string {
  const t = copy[language];
  if (!iso) return t.resetUnknown;
  const delta = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(delta)) return t.resetUnknown;
  if (delta <= 0) return t.resetNow;
  const minutes = Math.ceil(delta / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (language === "zh") {
    const duration = `${days ? `${days} 天 ` : ""}${hours ? `${hours} 小时 ` : ""}${mins} 分钟`;
    return `${duration}${t.resetIn}`;
  }
  const duration = `${days ? `${days}d ` : ""}${hours ? `${hours}h ` : ""}${mins}m`.trim();
  return `resets in ${duration}`;
}

function weeklyDate(iso: string | null | undefined, language: Language): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [creditOpen, setCreditOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => readSettings());
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<CodexUsageSnapshot | null>(() => readCached());
  const previous = useRef<CodexUsageSnapshot | null>(null);
  const refreshingRef = useRef(false);
  const edgeAnchor = useRef({ right: false, bottom: false });
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const remaining = snapshot?.fiveHour.remainingPercent;
  const tier = visualTier(remaining);
  const language = settings.language;
  const t = copy[language];

  const resizeNative = useCallback(async (nextExpanded: boolean) => {
    try {
      const win = getCurrentWindow();
      const [monitor, position, currentSize] = await Promise.all([currentMonitor(), win.outerPosition(), win.outerSize()]);
      const nextSize = nextExpanded ? EXPANDED : COLLAPSED;
      if (!monitor) {
        await win.setSize(new LogicalSize(nextSize, nextSize));
        return;
      }
      const currentRight = monitor.position.x + monitor.size.width - currentSize.width;
      const currentBottom = monitor.position.y + monitor.size.height - currentSize.height;
      const threshold = Math.round(18 * monitor.scaleFactor);
      if (nextExpanded) {
        edgeAnchor.current = {
          right: Math.abs(position.x - currentRight) <= threshold,
          bottom: Math.abs(position.y - currentBottom) <= threshold,
        };
      }
      const pixels = Math.round(nextSize * monitor.scaleFactor);
      const maxX = monitor.position.x + monitor.size.width - pixels;
      const maxY = monitor.position.y + monitor.size.height - pixels;
      const x = edgeAnchor.current.right ? maxX : Math.max(monitor.position.x, Math.min(position.x, maxX));
      const y = edgeAnchor.current.bottom ? maxY : Math.max(monitor.position.y, Math.min(position.y, maxY));
      await win.setSize(new LogicalSize(nextSize, nextSize));
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
    if (pinnedOpen && !force) return;
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setClosing(false);
      setCreditOpen(false);
      void resizeNative(false);
    }, 150);
  }, [pinnedOpen, resizeNative]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const next = normalizeSnapshot(await fetchUsage());
      next.consumptionState = inferConsumption(previous.current, next);
      previous.current = next;
      setSnapshot(next);
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      setSnapshot((current) => current ? { ...current, isCached: true } : current);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
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
      if (creditOpen) setCreditOpen(false);
      else {
        setPinnedOpen(false);
        closePanel(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, creditOpen]);

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
          const threshold = Math.round(14 * monitor.scaleFactor);
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
    if (pinnedOpen) return;
    closeTimer.current = window.setTimeout(() => closePanel(), 450);
  };

  const drag = async () => {
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Browser preview.
    }
  };

  const toggleTop = async () => {
    const next = !alwaysOnTop;
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
    } catch {
      // Browser preview.
    }
    setAlwaysOnTop(next);
  };

  if (!expanded) {
    return (
      <main className="orb-shell" onMouseEnter={enter} onMouseLeave={leave} onMouseDown={(event) => event.button === 0 && void drag()}>
        <button
          className={`quota-orb tier-${tier}`}
          aria-label={`${t.fiveHour}: ${remaining ?? t.unavailable}`}
          onClick={() => { setPinnedOpen(true); openPanel(); }}
        >
          <span className="aurora" aria-hidden="true" />
          <span className="orb-metric" aria-hidden="true">
            <strong>{percent(remaining)}</strong>
            {remaining !== null && remaining !== undefined && <small>%</small>}
          </span>
        </button>
      </main>
    );
  }

  const weekly = snapshot?.weekly.remainingPercent;
  const activity = snapshot?.consumptionState ?? "unknown";
  const credits = snapshot?.availableResets;

  return (
    <main className={`quota-card tier-${tier} ${closing ? "closing" : ""}`} onMouseEnter={enter} onMouseLeave={leave}>
      <span className="aurora" aria-hidden="true" />
      <header className="card-header" onMouseDown={(event) => event.button === 0 && void drag()}>
        <div>
          <strong className="eyebrow">{planLabel(snapshot?.plan)}</strong>
          <p className="subtitle">{t.fiveHour}</p>
        </div>
        <nav className="card-actions" aria-label="Widget controls" onMouseDown={(event) => event.stopPropagation()}>
          <span className={`activity activity-${activity}`} title={`${activity} · ${snapshot?.isCached ? "cached" : "live"}`} aria-label={activity} />
          <button className="language-button" onClick={() => setSettings((current) => ({ ...current, language: current.language === "zh" ? "en" : "zh" }))} title={t.language}>
            {language === "zh" ? "EN" : "中"}
          </button>
          <button className={`pin-button ${alwaysOnTop ? "active" : ""}`} onClick={() => void toggleTop()} title={alwaysOnTop ? t.pinOn : t.pinOff} aria-pressed={alwaysOnTop}>
            <Pin aria-hidden="true" />
          </button>
        </nav>
      </header>

      <section className="primary-metric" aria-label={t.fiveHour}>
        <strong>{percent(remaining)}</strong>
        {remaining !== null && remaining !== undefined && <small>%</small>}
      </section>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining ?? undefined}>
        <span style={{ width: `${remaining ?? 0}%` }} />
      </div>
      <p className="reset-time">{resetLabel(snapshot?.fiveHour.resetsAt, language)}</p>

      <footer className="card-footer">
        <div className="weekly-metric">
          <p>{t.weekly} · {t.until} {weeklyDate(snapshot?.weekly.resetsAt, language)}</p>
          <strong>{percent(weekly)}{weekly !== null && weekly !== undefined && <small>%</small>}</strong>
          <div className="credit-row">
            <span>{credits ?? "—"}{language === "zh" ? t.resetCredits : credits === 1 ? t.resetCredit : t.resetCredits}</span>
            <button onClick={() => setCreditOpen((open) => !open)}>{t.view}</button>
            {creditOpen && <aside className="credit-popover">{t.creditUnavailable}</aside>}
          </div>
        </div>
        <button className={`provider-mark ${refreshing ? "refreshing" : ""}`} onClick={() => void refresh()} title={t.refresh} disabled={refreshing}>
          <img src={codexMark} alt="" />
        </button>
      </footer>
    </main>
  );
}
