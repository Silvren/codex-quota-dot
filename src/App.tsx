import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, Pin, RefreshCw } from "./Icons";
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import "./App.css";
import { fetchUsage } from "./providers/usageProvider";
import type { CodexUsageSnapshot } from "./types/usage";
import { availableWindows, formatCreditBalance, inferConsumption, normalizeSnapshot, quotaLabel } from "./utils/usage";

const COLLAPSED = { width: 64, height: 64 } as const;
const EXPANDED = { width: 320, height: 256 } as const;
const CACHE_KEY = "codex-quota-dot:snapshot:v1";
const SETTINGS_KEY = "codex-quota-dot:settings:v3";
const POSITION_KEY = "codex-quota-dot:position";

type Language = "zh" | "en";
type Settings = { language: Language; refreshSeconds: 0 | 30 | 60 | 300 };
type VisualTier = "healthy" | "caution" | "critical" | "unknown";

const DEFAULT_SETTINGS: Settings = { language: "zh", refreshSeconds: 60 };

const copy = {
  zh: {
    until: "至",
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
    creditExpiry: "到期时间 · 本地时间",
    creditExpiryUnknown: "到期时间未知",
    creditExpired: "已到期",
    noCredits: "当前没有可用的重置机会。",
    creditPartial: "部分机会未提供到期时间。",
    resetOpportunity: "重置机会",
    creditBalance: "额度余额",
    balanceHint: "接口返回的 credits 点数，不是美元金额；与周期限额和重置机会分开计算。",
    consuming: "消耗中",
    idle: "空闲中",
    unknown: "监测中",
    openAndMove: "点击查看额度，拖动调整位置",
    collapse: "收起为悬浮球",
    nextReset: "下次重置",
    weeklyMarker: "周",
    quotaUnavailableNotice: "当前 Codex 未返回可用额度窗口，请稍后刷新",
    cached: "上次数据",
    refreshFailed: "更新失败，请检查 Codex 登录后重试",
    signIn: "请先在 Codex 中登录",
    loading: "正在读取额度…",
    healthy: "额度充足",
    caution: "留意用量",
    critical: "额度紧张",
    topFailed: "置顶设置失败，请重试",
  },
  en: {
    until: "until",
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
    creditExpiry: "Expires · local time",
    creditExpiryUnknown: "Expiration unknown",
    creditExpired: "Expired",
    noCredits: "No reset credits available.",
    creditPartial: "Some credit expiration times are unavailable.",
    resetOpportunity: "Reset credits",
    creditBalance: "Credit balance",
    balanceHint: "Credits reported by Codex, not USD. Separate from quota windows and reset credits.",
    consuming: "Consuming",
    idle: "Idle",
    unknown: "Monitoring",
    openAndMove: "Click to view usage; drag to reposition",
    collapse: "Collapse to quota orb",
    nextReset: "Next reset",
    weeklyMarker: "W",
    quotaUnavailableNotice: "Codex did not return an available quota window; try refreshing later",
    cached: "Saved data",
    refreshFailed: "Update failed. Check your Codex login and retry",
    signIn: "Sign in to Codex to see your quota",
    loading: "Reading usage…",
    healthy: "Healthy",
    caution: "Watch usage",
    critical: "Running low",
    topFailed: "Could not change pin setting. Try again",
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
  return plan ? `CODEX · ${plan.toUpperCase()}` : "CODEX";
}

function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value)}`;
}

function resetLabel(iso: string | null | undefined, language: Language, now: number): string {
  const t = copy[language];
  if (!iso) return t.resetUnknown;
  const delta = new Date(iso).getTime() - now;
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
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [topFailed, setTopFailed] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [snapshot, setSnapshot] = useState<CodexUsageSnapshot | null>(() => readCached());
  const previous = useRef<CodexUsageSnapshot | null>(null);
  const refreshingRef = useRef(false);
  const edgeAnchor = useRef({ right: false, bottom: false });
  const closeTimer = useRef<number | null>(null);
  const orbGesture = useRef<{ pointerId: number; x: number; y: number; dragged: boolean } | null>(null);

  const windows = snapshot?.authenticated ? availableWindows(snapshot) : [];
  const displayed = windows[0] ?? null;
  const secondary = windows[1] ?? null;
  const remaining = displayed?.window.remainingPercent;
  const displayedKind = displayed?.kind ?? null;
  const tier = visualTier(remaining);
  const language = settings.language;
  const t = copy[language];
  const activity = snapshot?.isCached || refreshFailed || !displayed ? "unknown" : snapshot?.consumptionState ?? "unknown";
  const displayedLabel = displayed ? quotaLabel(displayed, language) : t.unavailable;

  const resizeNative = useCallback(async (nextExpanded: boolean) => {
    try {
      const win = getCurrentWindow();
      const [monitor, position, currentSize] = await Promise.all([currentMonitor(), win.outerPosition(), win.outerSize()]);
      const nextSize = nextExpanded ? EXPANDED : COLLAPSED;
      if (!monitor) {
        await win.setSize(new LogicalSize(nextSize.width, nextSize.height));
        return;
      }
      const area = monitor.workArea;
      const currentRight = area.position.x + area.size.width - currentSize.width;
      const currentBottom = area.position.y + area.size.height - currentSize.height;
      const threshold = Math.round(18 * monitor.scaleFactor);
      if (nextExpanded) {
        edgeAnchor.current = {
          right: Math.abs(position.x - currentRight) <= threshold,
          bottom: Math.abs(position.y - currentBottom) <= threshold,
        };
      }
      const pixelWidth = Math.round(nextSize.width * monitor.scaleFactor);
      const pixelHeight = Math.round(nextSize.height * monitor.scaleFactor);
      const maxX = Math.max(area.position.x, area.position.x + area.size.width - pixelWidth);
      const maxY = Math.max(area.position.y, area.position.y + area.size.height - pixelHeight);
      const x = edgeAnchor.current.right ? maxX : Math.max(area.position.x, Math.min(position.x, maxX));
      const y = edgeAnchor.current.bottom ? maxY : Math.max(area.position.y, Math.min(position.y, maxY));
      await win.setSize(new LogicalSize(nextSize.width, nextSize.height));
      await win.setPosition(new PhysicalPosition(x, y));
    } catch {
      // Browser preview has no native window.
    }
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setClosing(false);
    setNow(Date.now());
    if (!expanded) {
      setExpanded(true);
      void resizeNative(true);
    }
  }, [expanded, resizeNative]);

  const closePanel = useCallback(() => {
    if (!expanded) return;
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setClosing(false);
      setCreditOpen(false);
      void resizeNative(false);
    }, 150);
  }, [expanded, resizeNative]);

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
      setNow(Date.now());
      setRefreshFailed(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
    } catch {
      previous.current = null;
      setRefreshFailed(true);
      setSnapshot((current) => current ? { ...current, isCached: true, consumptionState: "unknown" } : current);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage is optional. */ }
  }, [settings]);

  useEffect(() => {
    if (!expanded) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [expanded]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!creditOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(".credit-row")) setCreditOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [creditOpen]);

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
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        void win.setPosition(new PhysicalPosition(saved.x, saved.y)).catch(() => {});
      }
    } catch {
      // Ignore invalid position state.
    }
    let snapTimer: number | null = null;
    const unlisten = win.onMoved(({ payload: position }) => {
      try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* Storage is optional. */ }
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(async () => {
        try {
          const [monitor, size] = await Promise.all([currentMonitor(), win.outerSize()]);
          if (!monitor) return;
          const threshold = Math.round(14 * monitor.scaleFactor);
          const left = monitor.workArea.position.x;
          const top = monitor.workArea.position.y;
          const right = left + monitor.workArea.size.width - size.width;
          const bottom = top + monitor.workArea.size.height - size.height;
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
    if (pinBusy) return;
    const next = !alwaysOnTop;
    setPinBusy(true);
    try {
      if ("__TAURI_INTERNALS__" in window) await getCurrentWindow().setAlwaysOnTop(next);
      setAlwaysOnTop(next);
      setTopFailed(false);
    } catch {
      setTopFailed(true);
    } finally {
      setPinBusy(false);
    }
  };

  if (!expanded) {
    return (
      <main className="orb-shell">
        <button
          className={`quota-orb tier-${tier} ${draggingOrb ? "is-dragging" : ""} ${displayedKind === "weekly" ? "is-weekly" : ""}`}
          aria-label={`${snapshot?.isCached ? `${t.cached}. ` : ""}${displayedLabel}${remaining != null ? `: ${percent(remaining)}%` : ""}. ${t.openAndMove}`}
          title={`${snapshot?.isCached ? `${t.cached} · ` : ""}${displayedLabel}: ${percent(remaining)}${remaining != null ? "%" : ""}\n${t.openAndMove}`}
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
          <svg className="orb-ring" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="orb-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-end)" />
              </linearGradient>
            </defs>
            <circle className="orb-ring-track" cx="28" cy="28" r="21" />
            {remaining != null && remaining > 0 && (
              <circle className="orb-ring-value" cx="28" cy="28" r="21" pathLength="100"
                strokeDasharray={`${Math.max(0, Math.min(100, remaining))} 100`} transform="rotate(-90 28 28)" />
            )}
          </svg>
          <span className={`orb-metric ${remaining != null && Math.round(remaining) === 100 ? "three-digits" : ""}`} aria-hidden="true">
            <strong>{percent(remaining)}</strong>
            {remaining !== null && remaining !== undefined && <small>%</small>}
          </span>
          {displayedKind === "weekly" && <span className="orb-window-tag" aria-hidden="true">{t.weeklyMarker}</span>}
        </button>
      </main>
    );
  }

  const secondaryRemaining = secondary?.window.remainingPercent;
  const credits = snapshot?.authenticated ? snapshot.availableResets : null;
  const resetCredits = snapshot?.authenticated ? snapshot.resetCredits : null;
  const plan = snapshot?.authenticated ? snapshot.plan : null;

  return (
    <main lang={language === "zh" ? "zh-CN" : "en"} className={`quota-card tier-${tier} ${closing ? "closing" : ""}`}>
      <header className="card-header" onMouseDown={(event) => event.button === 0 && void drag()}>
        <div>
          <strong className="eyebrow" title={planLabel(plan)}>{planLabel(plan)}</strong>
        </div>
        <nav className="card-actions" aria-label="Widget controls" onMouseDown={(event) => event.stopPropagation()}>
          <span className="language-switch" aria-label={t.language}>
            <button aria-pressed={language === "zh"} className={language === "zh" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, language: "zh" }))}>中</button>
            <button aria-pressed={language === "en"} className={language === "en" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, language: "en" }))}>EN</button>
          </span>
          <button disabled={pinBusy} className={`pin-button ${alwaysOnTop ? "active" : ""}`} onClick={() => void toggleTop()} title={alwaysOnTop ? t.pinOn : t.pinOff} aria-pressed={alwaysOnTop}>
            <Pin aria-hidden="true" />
          </button>
          <button className="collapse-button" onClick={() => closePanel()} title={t.collapse} aria-label={t.collapse}>
            <ChevronDown aria-hidden="true" />
          </button>
        </nav>
      </header>

      <div className="quota-heading">
        <p className="subtitle">{displayedLabel}</p>
        <span className={`activity-label activity-${activity}`} title={`${activity} · ${snapshot?.isCached ? "cached" : "live"}`}>
          <i aria-hidden="true" />
          {snapshot?.isCached ? t.cached : t[activity]}
        </span>
      </div>

      <section className="primary-metric" aria-label={displayedLabel}>
        <strong>{percent(remaining)}</strong>
        {remaining !== null && remaining !== undefined && <small>%</small>}
      </section>
      <div className="progress-row">
        <div className="progress-track" role="progressbar" aria-label={displayedLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining ?? undefined} aria-valuetext={remaining == null ? t.unavailable : `${percent(remaining)}%`}>
          <span style={{ width: `${remaining ?? 0}%` }} />
        </div>
        {tier !== "unknown" && <span className="health-label">{t[tier]}</span>}
      </div>
      <p className="reset-time">
        {topFailed ? t.topFailed : refreshFailed ? t.refreshFailed : snapshot?.authenticated === false ? t.signIn
          : !snapshot && refreshing ? t.loading : displayed ? resetLabel(displayed.window.resetsAt, language, now) : t.quotaUnavailableNotice}
      </p>

      <div className="balance-row" title={t.balanceHint}>
        <span>{t.creditBalance}{snapshot?.isCached && <small> · {t.cached}</small>}</span>
        <strong>{formatCreditBalance(snapshot?.authenticated ? snapshot.creditBalance : null, language)}</strong>
      </div>

      <footer className="card-footer">
        {secondary ? (
          <div className="weekly-metric">
            <p>{quotaLabel(secondary, language)}</p>
            <div className="weekly-value">
              <strong>{percent(secondaryRemaining)}<small>%</small></strong>
              {secondary.window.resetsAt && <span className="metric-date" title={resetLabel(secondary.window.resetsAt, language, now)}>{t.until} {weeklyDate(secondary.window.resetsAt, language)}</span>}
            </div>
          </div>
        ) : (
          <div className="weekly-metric">
            <p>{t.nextReset}</p>
            <div className="reset-date">
              {displayed?.window.resetsAt && Number.isFinite(Date.parse(displayed.window.resetsAt)) ? <>
                <strong>{weeklyDate(displayed.window.resetsAt, language)}</strong>
                <span className="metric-date">{new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", {
                  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
                }).format(new Date(displayed.window.resetsAt))}</span>
              </> : <span className="metric-date">{t.resetUnknown}</span>}
            </div>
          </div>
        )}
        <div className="credit-metric">
          <p>{t.resetOpportunity}</p>
          <div className="credit-row">
            <strong>{credits ?? "—"}</strong>
            <button aria-expanded={creditOpen} aria-controls="credit-details" onClick={() => setCreditOpen((open) => !open)}>{t.view}</button>
            {creditOpen && <aside id="credit-details" className="credit-popover" aria-label={t.resetOpportunity}>
              {credits === 0 ? t.noCredits : resetCredits?.length ? <>
                <div className="credit-details-heading">{t.creditExpiry}{snapshot?.isCached && <span>{t.cached}</span>}</div>
                <ol className="credit-expirations">
                  {resetCredits.map((credit, index) => <li key={`${credit.expiresAt}-${index}`}>
                    <span className="credit-index">{index + 1}</span>
                    <div>{credit.expiresAt ? <time dateTime={credit.expiresAt}>{new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", {
                      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
                    }).format(new Date(credit.expiresAt))}</time> : t.creditExpiryUnknown}
                    {credit.expiresAt && Date.parse(credit.expiresAt) <= now && <span className="credit-expired">{t.creditExpired}</span>}</div>
                  </li>)}
                </ol>
                {credits !== null && resetCredits.length < credits && <p className="credit-details-note">{t.creditPartial}</p>}
              </> : t.creditUnavailable}
            </aside>}
          </div>
        </div>
        <button className={`provider-mark ${refreshing ? "refreshing" : ""}`} onClick={() => void refresh()} title={t.refresh} disabled={refreshing}>
          <RefreshCw aria-hidden="true" />
        </button>
      </footer>
    </main>
  );
}
