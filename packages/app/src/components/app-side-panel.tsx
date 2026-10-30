import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { parseISO } from "date-fns";

import {
  SidePanelProvider,
  useSidePanel,
  type SidePanelDescriptor,
  type SidePanelRegistry,
} from "@/components/side-panel";
import {
  CALENDAR_DAY_PANEL,
  CalendarDayPanel,
} from "@/features/calendar/components/calendar-day-panel";
import { dayKey } from "@/features/calendar/lib/date-utils";
import {
  derivePanelDescriptor,
  withPanelParams,
  withoutPanelParams,
} from "@/lib/side-panel-params";

const PANEL_REGISTRY: SidePanelRegistry = {
  [CALENDAR_DAY_PANEL]: { component: CalendarDayPanel, title: "Day detail" },
};

const isKnownPanelKind = (kind: string): boolean => Object.hasOwn(PANEL_REGISTRY, kind);

function useOpenPanel(): (kind: string, id: string) => void {
  const [, setSearchParams] = useSearchParams();

  return useCallback(
    (kind: string, id: string) => {
      setSearchParams((current) => withPanelParams(current, kind, id), { replace: true });
    },
    [setSearchParams],
  );
}

function usePanelClose(): () => void {
  const [, setSearchParams] = useSearchParams();

  return useCallback(() => {
    setSearchParams((current) => withoutPanelParams(current), { replace: true });
  }, [setSearchParams]);
}

export interface CalendarDayPanelControls {
  selectedDate: Date | null;
  selectDay: (date: Date) => void;
  openDay: (date: Date) => void;
}

export function useCalendarDayPanel(): CalendarDayPanelControls {
  const { descriptor } = useSidePanel();
  const openPanel = useOpenPanel();
  const closePanel = usePanelClose();

  const selectedKey = descriptor?.kind === CALENDAR_DAY_PANEL ? descriptor.id : null;
  const selectedDate = useMemo(
    () => (selectedKey === null ? null : parseISO(selectedKey)),
    [selectedKey],
  );

  const openDay = useCallback(
    (date: Date) => {
      openPanel(CALENDAR_DAY_PANEL, dayKey(date));
    },
    [openPanel],
  );

  const selectDay = useCallback(
    (date: Date) => {
      if (dayKey(date) === selectedKey) {
        closePanel();
        return;
      }
      openPanel(CALENDAR_DAY_PANEL, dayKey(date));
    },
    [closePanel, openPanel, selectedKey],
  );

  return { selectedDate, selectDay, openDay };
}

export function AppSidePanelProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const closePanel = usePanelClose();

  const descriptor = useMemo<SidePanelDescriptor | null>(
    () => derivePanelDescriptor(searchParams, isKnownPanelKind),
    [searchParams],
  );

  return (
    <SidePanelProvider registry={PANEL_REGISTRY} descriptor={descriptor} onClose={closePanel}>
      {children}
    </SidePanelProvider>
  );
}
