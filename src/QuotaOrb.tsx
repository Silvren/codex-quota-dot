import type { PointerEventHandler } from "react";
import type { DisplayedQuotaWindow } from "./utils/usage";
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

function colorClass(value: number | null): string {
  if (value === null) return "orb-tone-unknown";
  if (value < 10) return "orb-tone-critical";
  if (value < 50) return "orb-tone-caution";
  return "orb-tone-healthy";
}

export default function QuotaOrb({
  windows, language, cached, dragging, unavailableText, instructionText,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onOpen,
}: QuotaOrbProps) {
  const weekly = windows.find((window) => window.kind === "weekly");
  const reported = weekly?.window.remainingPercent;
  const value = typeof reported === "number" && Number.isFinite(reported)
    ? Math.max(0, Math.min(100, reported)) : null;
  const percentage = value === null ? "—" : `${Math.round(value)}`;
  const description = weekly && value !== null
    ? `${language === "zh" ? "周额度剩余" : "Weekly remaining"}: ${Math.round(value * 10) / 10}%` : unavailableText;
  const cachedLabel = cached ? (language === "zh" ? "缓存数据" : "Cached data") : "";
  const title = [description, cachedLabel, instructionText].filter(Boolean).join("\n");

  return (
    <button
      type="button"
      className={`quota-orb ${colorClass(value)}${dragging ? " is-dragging" : ""}`}
      title={title}
      aria-label={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(event) => {
        // Pointer activation is handled by the parent's click/drag gesture.
        if (event.detail === 0) onOpen();
      }}
    >
      <svg className="orb-arcs" viewBox="0 0 56 56" aria-hidden="true">
        <g className={`orb-arc ${colorClass(value)}`}>
          <circle className="orb-arc-track" cx="28" cy="28" r="21" pathLength={100} />
          {value !== null && value > 0 && (
            <circle className="orb-arc-value" cx="28" cy="28" r="21" pathLength={100}
              transform="rotate(-90 28 28)" strokeDasharray={`${value} 100`} />
          )}
        </g>
      </svg>
      <span className="orb-readout" aria-hidden="true">
        <span className={`orb-number${percentage.length > 2 ? " has-three-digits" : ""}`}>
          <strong>{percentage}</strong>
          {value !== null && <small>%</small>}
        </span>
      </span>
    </button>
  );
}
