/** Format ms timestamp → "MM/DD/YYYY - HH:mm:ss". */
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
