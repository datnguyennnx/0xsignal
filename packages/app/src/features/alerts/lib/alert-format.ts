import type { Rule } from "@0xsignal/shared/alerts/index.ts";

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function formatCooldown(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/**
 * `In-app · once` or `In-app · repeats every 10m`, plus the last fire when known.
 */
export function describeDeliveryMeta(
  alert: Pick<Rule, "once" | "cooldown_seconds">,
  lastFiredAt?: string,
  now: number = Date.now(),
): string {
  const cadence =
    alert.once === true ? "once" : `repeats every ${formatCooldown(alert.cooldown_seconds)}`;
  const meta = `In-app · ${cadence}`;
  return lastFiredAt === undefined
    ? meta
    : `${meta} · Last fired ${formatRelativeTime(lastFiredAt, now)}`;
}
