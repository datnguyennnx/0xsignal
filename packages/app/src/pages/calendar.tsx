import type { JSX } from "react";
import { useLocation } from "react-router-dom";
import { CalendarBoard } from "@/features/calendar/components/calendar-board";
import { ErrorBoundary } from "@/components/error-boundary";

export function CalendarPage(): JSX.Element {
  const { pathname } = useLocation();

  return (
    <div className="container-fluid flex flex-1 min-h-0 flex-col">
      <h1 className="sr-only">Calendar</h1>
      <ErrorBoundary resetKey={pathname}>
        <CalendarBoard />
      </ErrorBoundary>
    </div>
  );
}
