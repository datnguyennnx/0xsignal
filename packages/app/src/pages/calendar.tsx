import { useEffect } from "react";
import type { JSX } from "react";
import { useLocation } from "react-router-dom";
import { CalendarBoard } from "@/features/calendar";
import { ErrorBoundary } from "@/components/error-boundary";

export function CalendarPage(): JSX.Element {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = "Calendar | 0xsignal";
  }, []);

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="sr-only">Calendar</h1>
      <ErrorBoundary resetKey={pathname}>
        <CalendarBoard />
      </ErrorBoundary>
    </div>
  );
}
