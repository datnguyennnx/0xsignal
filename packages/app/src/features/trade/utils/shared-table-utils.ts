/**
 * Format a Unix timestamp (ms) to a human-readable date-time string.
 */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${mm}/${dd}/${yyyy} - ${hh}:${min}:${ss}`;
}

/**
 * Convert an order status string to a human-readable label.
 */
export function formatStatus(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "filled":
      return "Filled";
    case "triggered":
      return "Triggered";
    default:
      if (status.toLowerCase().includes("cancel")) return "Canceled";
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Compact number formatting: millions (M), thousands (K),
 * or raw with decreasing precision for small values.
 */
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}
