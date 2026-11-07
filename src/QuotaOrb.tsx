import { useRef, useState, type PointerEventHandler } from "react";
import { quotaLabel, type DisplayedQuotaWindow } from "./utils/usage";
import "./QuotaOrb.css";

export interface QuotaOrbProps {
  windows: DisplayedQuotaWindow[];
  language: "zh" | "en";
  cached: boolean;
  dragging: boolean;
  unavailableText: string;
  instructionText: string;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onOpen: () => void;
}

function remaining(window: DisplayedQuotaWindow | undefined): number | null {
  const value = window?.window.remainingPercent;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function colorClass(value: number | null): string {
  if (value === null) return "orb-tone-unknown";
  if (value < 10) return "orb-tone-critical";
  if (value < 50) return "orb-tone-caution";
  return "orb-tone-healthy";
}

function periodLabel(value: DisplayedQuotaWindow, language: "zh" | "en"): string {
  if (value.kind === "weekly") return language === "zh" ? "本周" : "week";
  const seconds = value.window.resetDurationSeconds;
  if (!seconds || !Number.isFinite(seconds)) return language === "zh" ? "周期" : "quota";
  const unit = seconds % 86_400 === 0 ? 86_400 : seconds % 3_600 === 0 ? 3_600 : 60;
  const amount = Math.round(seconds / unit * 10) / 10;
  const suffix = language === "zh"
    ? (unit === 86_400 ? "天" : unit === 3_600 ? "小时" : "分钟")
    : (unit === 86_400 ? "d" : unit === 3_600 ? "h" : "m");
  return `${amount}${suffix}`;
}

const ARC_PATHS = [
  "M11.93 14.5 A21 21 0 0 1 44.07 14.5",
  "M48.28 22.56 A21 21 0 1 1 7.72 22.56",
];

export default function QuotaOrb({
  windows, language, cached, dragging, unavailableText, instructionText,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onOpen,
}: QuotaOrbProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pointerDown = useRef(false);
  const displayed = windows.slice(0, 2);
  const selected = Math.min(selectedIndex, Math.max(0, displayed.length - 1));
  const activeWindow = displayed[selected];
  const value = remaining(activeWindow);
  const percentage = value === null ? "—" : `${Math.round(value)}`;
  const formatValue = (window: DisplayedQuotaWindow) => {
    const amount = remaining(window);
    return `${quotaLabel(window, language)}: ${amount === null ? unavailableText : `${Math.round(amount * 10) / 10}%`}`;
  };
  const activeDescription = activeWindow ? formatValue(activeWindow) : unavailableText;
  const cachedLabel = cached ? (language === "zh" ? "缓存数据" : "Cached data") : "";
  const title = [activeDescription, cachedLabel, instructionText].filter(Boolean).join("\n");
  const selectionLabel = language === "zh" ? "当前显示" : "Showing";
  const ariaLabel = [
    displayed.length ? displayed.map(formatValue).join("; ") : unavailableText,
    displayed.length ? `${selectionLabel}: ${activeDescription}` : "",
    cachedLabel,
    instructionText,
  ].filter(Boolean).join(". ");

  const selectAtPointer: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (pointerDown.current || dragging || displayed.length < 2 || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const y = (event.clientY - bounds.top) * 56 / bounds.height;
    setSelectedIndex(y < 20 ? 0 : 1);
  };

  return (
    <button
      type="button"
      className={`quota-orb ${colorClass(value)}${dragging ? " is-dragging" : ""}`}
      title={title}
      aria-label={ariaLabel}
      onPointerEnter={selectAtPointer}
      onPointerLeave={() => setSelectedIndex(0)}
      onPointerDown={(event) => {
        pointerDown.current = true;
        onPointerDown(event);
      }}
      onPointerMove={(event) => {
        selectAtPointer(event);
        onPointerMove(event);
      }}
      onPointerUp={(event) => {
        pointerDown.current = false;
        onPointerUp(event);
      }}
      onPointerCancel={(event) => {
        pointerDown.current = false;
        onPointerCancel(event);
      }}
      onLostPointerCapture={() => { pointerDown.current = false; }}
      onClick={(event) => {
        // Pointer activation is handled by the parent's click/drag gesture.
        if (event.detail === 0) onOpen();
      }}
      onKeyDown={(event) => {
        if (displayed.length > 1 && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          setSelectedIndex(event.key === "ArrowUp" ? 0 : 1);
        }
      }}
    >
      <svg className="orb-arcs" viewBox="0 0 56 56" aria-hidden="true">
        {displayed.length > 1 ? displayed.map((window, index) => {
          const amount = remaining(window);
          return (
            <g
              key={index}
              className={`orb-arc ${colorClass(amount)}${index === selected ? " is-selected" : ""}`}
            >
              <path className="orb-arc-track" d={ARC_PATHS[index]} pathLength={100} />
              {amount !== null && amount > 0 && (
                <path
                  className="orb-arc-value"
                  d={ARC_PATHS[index]}
                  pathLength={100}
                  strokeDasharray={`${amount} 100`}
                />
              )}
            </g>
          );
        }) : (
          <g className={`orb-arc is-selected ${colorClass(value)}`}>
            <circle className="orb-arc-track" cx="28" cy="28" r="21" pathLength={100} />
            {value !== null && value > 0 && (
              <circle
                className="orb-arc-value"
                cx="28"
                cy="28"
                r="21"
                pathLength={100}
                transform="rotate(-90 28 28)"
                strokeDasharray={`${value} 100`}
              />
            )}
          </g>
        )}
      </svg>
      <span className="orb-readout" aria-hidden="true">
        <span className={`orb-number${percentage.length > 2 ? " has-three-digits" : ""}`}>
          <strong>{percentage}</strong>
          {value !== null && <small>%</small>}
        </span>
        <span className="orb-period">{activeWindow ? periodLabel(activeWindow, language) : language === "zh" ? "额度" : "quota"}</span>
      </span>
    </button>
  );
}
