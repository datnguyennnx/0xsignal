import type { JSX } from "react";

import { isValid, parseISO } from "date-fns";

import { ErrorState } from "@/components/error-state";
import type { PanelComponentProps } from "@/components/side-panel";

import { useCalendarDay } from "../hooks/use-calendar-day";

import { DayDetailPanel } from "./day-detail-panel";

export { CALENDAR_DAY_PANEL } from "@/lib/panel-kind";

function CalendarDayEvents({ id, day }: { id: string; day: Date }): JSX.Element {
  const { state, onRetry } = useCalendarDay(id, day);

  return <DayDetailPanel date={day} state={state} onRetry={onRetry} />;
}

export function CalendarDayPanel({ id }: PanelComponentProps): JSX.Element {
  const day = parseISO(id);

  if (!isValid(day)) {
    return <ErrorState title="Unable to load events" />;
  }

  return <CalendarDayEvents id={id} day={day} />;
}
