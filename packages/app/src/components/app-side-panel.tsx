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
import { CalendarDayPanel } from "@/features/calendar/components/calendar-day-panel";
import { dayKey } from "@/features/calendar/lib/date-utils";
import { CoinContextPanel } from "@/features/whales/components/coin-context-panel";
import {
  derivePanelDescriptor,
  isKnownPanelKind,
  PANEL_KINDS,
  withPanelParams,
  withoutPanelParams,
} from "@/lib/side-panel-params";

type PanelRegistryEntry = SidePanelRegistry[string];

const PANEL_COMPONENTS: Record<keyof typeof PANEL_KINDS, PanelRegistryEntry> = {
  calendarDay: { component: CalendarDayPanel, title: "Day detail" },
  coinContext: { component: CoinContextPanel, title: "Coin market" },
};

const PANEL_REGISTRY: SidePanelRegistry = {
  [PANEL_KINDS.calendarDay.kind]: PANEL_COMPONENTS.calendarDay,
  [PANEL_KINDS.coinContext.kind]: PANEL_COMPONENTS.coinContext,
};

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

  const selectedKey = descriptor?.kind === PANEL_KINDS.calendarDay.kind ? descriptor.id : null;
  const selectedDate = useMemo(
    () => (selectedKey === null ? null : parseISO(selectedKey)),
    [selectedKey],
  );

  const openDay = useCallback(
    (date: Date) => {
      openPanel(PANEL_KINDS.calendarDay.kind, dayKey(date));
    },
    [openPanel],
  );

  const selectDay = useCallback(
    (date: Date) => {
      if (dayKey(date) === selectedKey) {
        closePanel();
        return;
      }
      openPanel(PANEL_KINDS.calendarDay.kind, dayKey(date));
    },
    [closePanel, openPanel, selectedKey],
  );

  return { selectedDate, selectDay, openDay };
}

export interface CoinContextPanelControls {
  activeCoin: string | null;
  openCoin: (coin: string) => void;
  close: () => void;
}

export function useCoinContextPanel(): CoinContextPanelControls {
  const { descriptor } = useSidePanel();
  const openPanel = useOpenPanel();
  const close = usePanelClose();

  const activeCoin = descriptor?.kind === PANEL_KINDS.coinContext.kind ? descriptor.id : null;

  const openCoin = useCallback(
    (coin: string) => {
      openPanel(PANEL_KINDS.coinContext.kind, coin);
    },
    [openPanel],
  );

  return { activeCoin, openCoin, close };
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
