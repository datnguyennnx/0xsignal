import type { EconomicEvent } from "@0xsignal/shared";

export interface MonthDayCellProps {
  date: Date;
  events: EconomicEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: Date) => void;
}

/**
 * `MonthGrid` re-renders on every parent state tick (refetch, pending), but a
 * cell only paints its date, its event list, three flags and the callback.
 * Compare those and skip the other 41 cells.
 */
export function areMonthDayCellPropsEqual(
  prev: MonthDayCellProps,
  next: MonthDayCellProps,
): boolean {
  return (
    prev.date.getTime() === next.date.getTime() &&
    prev.events === next.events &&
    prev.isCurrentMonth === next.isCurrentMonth &&
    prev.isToday === next.isToday &&
    prev.isSelected === next.isSelected &&
    prev.onSelect === next.onSelect
  );
}
