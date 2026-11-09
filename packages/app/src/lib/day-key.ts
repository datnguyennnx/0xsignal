/**
 * Local-date day keys (`yyyy-MM-dd`), used by the calendar grid and the side
 * panel id. Deliberately import-free: the shell formats day keys on every
 * calendar interaction, so this must not pull date-fns into the entry graph.
 */
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${month}-${day}`;
}

/** Parses the local midnight of a day key; `null` when the key is not a real day. */
export function parseDayKey(key: string): Date | null {
  const match = DAY_KEY_PATTERN.exec(key);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // `new Date` rolls 2026-02-31 forward; reject anything that did not round-trip.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}
