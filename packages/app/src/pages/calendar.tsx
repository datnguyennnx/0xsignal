import { useEffect } from "react";
import type { JSX } from "react";
import { CalendarBoard } from "@/features/calendar";
import { ErrorBoundary } from "@/components/error-boundary";

export function CalendarPage(): JSX.Element {
  useEffect(() => {
    document.title = "Calendar | 0xsignal";
  }, []);

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="text-xl font-semibold">Calendar</h1>

      <ErrorBoundary>
        <CalendarBoard />
      </ErrorBoundary>
    </div>
  );
}
