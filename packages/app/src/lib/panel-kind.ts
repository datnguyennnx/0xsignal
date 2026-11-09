/**
 * Panel kind ids shared by the shell (entry graph) and the panel modules (lazy).
 *
 * Import-free on purpose: a value import from a panel module would drag that
 * module's whole graph (date-fns, charts) back into the entry chunk.
 */
export const CALENDAR_DAY_PANEL = "calendar-day";
