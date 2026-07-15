export function formatReset(iso: string | null, now = Date.now()): string {
  if (!iso) return "Reset time unavailable";
  const delta = new Date(iso).getTime() - now;
  if (!Number.isFinite(delta)) return "Reset time unavailable";
  if (delta <= 0) return "Reset due now";
  const minutes = Math.ceil(delta / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return `Resets in ${days ? `${days}d ` : ""}${hours ? `${hours}h ` : ""}${mins}m`.trim();
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown time" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatUpdated(iso: string, now = Date.now()): string {
  const delta = Math.max(0, now - new Date(iso).getTime());
  if (!Number.isFinite(delta)) return "at an unknown time";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
