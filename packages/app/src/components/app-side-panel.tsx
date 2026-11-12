import { lazy, Suspense, useCallback, useMemo } from "react";
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { useSearchParams } from "react-router";

import {
  PanelActionsContext,
  useOpenPanel,
  usePanelClose,
  type PanelActions,
} from "@/components/app-side-panel-context";
import {
  SidePanelProvider,
  useSidePanel,
  type PanelComponentProps,
  type SidePanelDescriptor,
  type SidePanelRegistry,
} from "@/components/side-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { dayKey, parseDayKey } from "@/lib/day-key";
import {
  derivePanelDescriptor,
  isKnownPanelKind,
  PANEL_ID_PARAM,
  PANEL_KINDS,
  PANEL_PARAM,
} from "@/lib/side-panel-params";

type PanelRegistryEntry = SidePanelRegistry[string];

const CalendarDayPanelLazy = lazy(() =>
  import("@/features/calendar/components/calendar-day-panel").then((m) => ({
    default: m.CalendarDayPanel,
  })),
);

const CoinContextPanelLazy = lazy(() =>
  import("@/features/whales/components/coin-context-panel").then((m) => ({
    default: m.CoinContextPanel,
  })),
);

type PanelLoader = LazyExoticComponent<ComponentType<PanelComponentProps>>;

function PanelFallback() {
  return <Skeleton className="h-32 rounded-panel" />;
}

function LazyPanel({ load: Panel, ...props }: { load: PanelLoader } & PanelComponentProps) {
  return (
    <Suspense fallback={<PanelFallback />}>
      <Panel {...props} />
    </Suspense>
  );
}

function CalendarDayPanel(props: PanelComponentProps) {
  return <LazyPanel load={CalendarDayPanelLazy} {...props} />;
}

function CoinContextPanel(props: PanelComponentProps) {
  return <LazyPanel load={CoinContextPanelLazy} {...props} />;
}

const PANEL_COMPONENTS: Record<keyof typeof PANEL_KINDS, PanelRegistryEntry> = {
  calendarDay: { component: CalendarDayPanel, title: "Day detail" },
  coinContext: { component: CoinContextPanel, title: "Coin market" },
};

const PANEL_REGISTRY: SidePanelRegistry = {
  [PANEL_KINDS.calendarDay.kind]: PANEL_COMPONENTS.calendarDay,
  [PANEL_KINDS.coinContext.kind]: PANEL_COMPONENTS.coinContext,
};

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
    () => (selectedKey === null ? null : parseDayKey(selectedKey)),
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
  const openPanel = useOpenPanel();
  const closePanel = usePanelClose();

  const panelKind = searchParams.get(PANEL_PARAM);
  const panelId = searchParams.get(PANEL_ID_PARAM);
  // Only the two params the descriptor reads: an unrelated search write keeps
  // the same descriptor object, so the context value stays stable.
  const descriptor = useMemo<SidePanelDescriptor | null>(() => {
    const params = new URLSearchParams();
    if (panelKind !== null) params.set(PANEL_PARAM, panelKind);
    if (panelId !== null) params.set(PANEL_ID_PARAM, panelId);
    return derivePanelDescriptor(params, isKnownPanelKind);
  }, [panelKind, panelId]);

  const actions = useMemo<PanelActions>(() => ({ openPanel, closePanel }), [openPanel, closePanel]);

  return (
    <PanelActionsContext.Provider value={actions}>
      <SidePanelProvider registry={PANEL_REGISTRY} descriptor={descriptor} onClose={closePanel}>
        {children}
      </SidePanelProvider>
    </PanelActionsContext.Provider>
  );
}
