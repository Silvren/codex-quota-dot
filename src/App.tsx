import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, Pin, Terminal } from "lucide-react";
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import "./App.css";
import { fetchUsage } from "./providers/usageProvider";
import type { CodexUsageSnapshot } from "./types/usage";
import { inferConsumption, normalizeSnapshot, selectDisplayedWindow } from "./utils/usage";

const COLLAPSED = { width: 84, height: 84 } as const;
const EXPANDED = { width: 480, height: 360 } as const;
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
    resetOpportunity: "重置机会",
    consuming: "消耗中",
    idle: "空闲中",
    unknown: "监测中",
    openAndMove: "点击查看额度，拖动调整位置",
    collapse: "收起为悬浮球",
    shortWindow: "短周期额度",
    shortWindowUnavailable: "短周期额度暂未返回",
    weeklyMarker: "周",
    quotaPolicyNotice: "当前 Codex 未返回短周期额度，可能与套餐或额度策略调整有关",
    quotaUnavailableNotice: "当前 Codex 未返回可用额度窗口，请稍后刷新",
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
    resetOpportunity: "Reset credits",
    consuming: "Consuming",
    idle: "Idle",
    unknown: "Monitoring",
    openAndMove: "Click to view usage; drag to reposition",
    collapse: "Collapse to quota orb",
    shortWindow: "Short-window quota",
    shortWindowUnavailable: "Short-window quota unavailable",
    weeklyMarker: "W",
    quotaPolicyNotice: "Codex did not return a short quota window; this may depend on plan or quota-policy changes",
    quotaUnavailableNotice: "Codex did not return an available quota window; try refreshing later",
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
  const [draggingOrb, setDraggingOrb] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [creditOpen, setCreditOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => readSettings());
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<CodexUsageSnapshot | null>(() => readCached());
  const previous = useRef<CodexUsageSnapshot | null>(null);
  const refreshingRef = useRef(false);
  const edgeAnchor = useRef({ right: false, bottom: false });
  const closeTimer = useRef<number | null>(null);
  const orbGesture = useRef<{ pointerId: number; x: number; y: number; dragged: boolean } | null>(null);

  const displayed = snapshot ? selectDisplayedWindow(snapshot) : null;
  const remaining = displayed?.window.remainingPercent;
  const displayedKind = displayed?.kind ?? null;
  const tier = visualTier(remaining);
  const language = settings.language;
  const t = copy[language];
  const displayedLabel = displayedKind === "weekly" ? t.weekly : displayedKind === "fiveHour" ? t.fiveHour : t.unavailable;

  const resizeNative = useCallback(async (nextExpanded: boolean) => {
    try {
      const win = getCurrentWindow();
      const [monitor, position, currentSize] = await Promise.all([currentMonitor(), win.outerPosition(), win.outerSize()]);
      const nextSize = nextExpanded ? EXPANDED : COLLAPSED;
      if (!monitor) {
        await win.setSize(new LogicalSize(nextSize.width, nextSize.height));
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
      const pixelWidth = Math.round(nextSize.width * monitor.scaleFactor);
      const pixelHeight = Math.round(nextSize.height * monitor.scaleFactor);
      const maxX = monitor.position.x + monitor.size.width - pixelWidth;
      const maxY = monitor.position.y + monitor.size.height - pixelHeight;
      const x = edgeAnchor.current.right ? maxX : Math.max(monitor.position.x, Math.min(position.x, maxX));
      const y = edgeAnchor.current.bottom ? maxY : Math.max(monitor.position.y, Math.min(position.y, maxY));
      await win.setSize(new LogicalSize(nextSize.width, nextSize.height));
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

  const closePanel = useCallback(() => {
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setClosing(false);
      setCreditOpen(false);
      void resizeNative(false);
    }, 150);
  }, [resizeNative]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const next = normalizeSnapshot(await fetchUsage());
      const inferred = inferConsumption(previous.current, next);
      next.consumptionState = inferred === "unknown" ? next.consumptionState : inferred;
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
      else closePanel();
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

  const drag = async () => {
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Browser preview.
    }
  };

  const beginOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    orbGesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = orbGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.dragged) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 5) return;
    gesture.dragged = true;
    setDraggingOrb(true);
    void drag().finally(() => {
      setDraggingOrb(false);
      orbGesture.current = null;
    });
  };

  const finishOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = orbGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const shouldOpen = !gesture.dragged;
    orbGesture.current = null;
    setDraggingOrb(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (shouldOpen) openPanel();
  };

  const cancelOrbGesture = () => {
    orbGesture.current = null;
    setDraggingOrb(false);
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
      <main className="orb-shell">
        <button
          className={`quota-orb tier-${tier} ${draggingOrb ? "is-dragging" : ""}`}
          aria-label={`${displayedLabel}: ${remaining ?? t.unavailable}. ${t.openAndMove}`}
          title={t.openAndMove}
          onPointerDown={beginOrbGesture}
          onPointerMove={moveOrbGesture}
          onPointerUp={finishOrbGesture}
          onPointerCancel={cancelOrbGesture}
          onClick={(event) => { if (event.detail === 0) openPanel(); }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            openPanel();
          }}
          onDragStart={(event) => event.preventDefault()}
        >
          <span
            className="orb-ring"
            style={{ "--quota-degrees": `${Math.max(0, Math.min(100, remaining ?? 0)) * 3.6}deg` } as CSSProperties}
            aria-hidden="true"
          />
          <span className={`orb-status activity-${snapshot?.consumptionState ?? "unknown"}`} aria-hidden="true" />
          <span className="orb-metric" aria-hidden="true">
            <strong>{percent(remaining)}</strong>
            {remaining !== null && remaining !== undefined && <small>%</small>}
          </span>
          {displayedKind === "weekly" && <span className="orb-window-tag" aria-hidden="true">{t.weeklyMarker}</span>}
        </button>
      </main>
    );
  }

  const weekly = snapshot?.weekly.remainingPercent;
  const activity = snapshot?.consumptionState ?? "unknown";
  const credits = snapshot?.availableResets;

  return (
    <main className={`quota-card tier-${tier} ${closing ? "closing" : ""}`}>
      <header className="card-header" onMouseDown={(event) => event.button === 0 && void drag()}>
        <div>
          <strong className="eyebrow">{planLabel(snapshot?.plan)}</strong>
          <p className="subtitle">{displayedLabel}</p>
        </div>
        <nav className="card-actions" aria-label="Widget controls" onMouseDown={(event) => event.stopPropagation()}>
          <span className={`activity-label activity-${activity}`} title={`${activity} · ${snapshot?.isCached ? "cached" : "live"}`}>
            <i aria-hidden="true" />
            {t[activity]}
          </span>
          <span className="language-switch" aria-label={t.language}>
            <button className={language === "zh" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, language: "zh" }))}>中</button>
            <button className={language === "en" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, language: "en" }))}>EN</button>
          </span>
          <button className={`pin-button ${alwaysOnTop ? "active" : ""}`} onClick={() => void toggleTop()} title={alwaysOnTop ? t.pinOn : t.pinOff} aria-pressed={alwaysOnTop}>
            <Pin aria-hidden="true" />
          </button>
          <button className="collapse-button" onClick={() => closePanel()} title={t.collapse} aria-label={t.collapse}>
            <ChevronDown aria-hidden="true" />
          </button>
        </nav>
      </header>

      <section className="primary-metric" aria-label={displayedLabel}>
        <strong>{percent(remaining)}</strong>
        {remaining !== null && remaining !== undefined && <small>%</small>}
      </section>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining ?? undefined}>
        <span style={{ width: `${remaining ?? 0}%` }} />
      </div>
      <p className={`reset-time ${displayedKind === "weekly" ? "quota-policy-note" : ""}`}>
        {displayed
          ? `${resetLabel(displayed.window.resetsAt, language)}${displayedKind === "weekly" ? ` · ${t.shortWindowUnavailable}` : ""}`
          : t.quotaUnavailableNotice}
      </p>

      <footer className="card-footer">
        {displayedKind === "weekly" ? (
          <div className="weekly-metric fallback-metric" title={t.quotaPolicyNotice}>
            <p>{t.shortWindow}</p>
            <strong>{t.unavailable}</strong>
          </div>
        ) : (
          <div className="weekly-metric">
            <p>{t.weekly} · {t.until} {weeklyDate(snapshot?.weekly.resetsAt, language)}</p>
            <strong>{percent(weekly)}{weekly !== null && weekly !== undefined && <small>%</small>}</strong>
          </div>
        )}
        <div className="credit-metric">
          <p>{t.resetOpportunity}</p>
          <div className="credit-row">
            <span>{credits ?? "—"}{language === "zh" ? t.resetCredits : credits === 1 ? t.resetCredit : t.resetCredits}</span>
            <button onClick={() => setCreditOpen((open) => !open)}>{t.view}</button>
            {creditOpen && <aside className="credit-popover">{t.creditUnavailable}</aside>}
          </div>
        </div>
        <button className={`provider-mark ${refreshing ? "refreshing" : ""}`} onClick={() => void refresh()} title={t.refresh} disabled={refreshing}>
          <Terminal aria-hidden="true" />
        </button>
      </footer>
    </main>
  );
}
