import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import {
  SidePanelProvider,
  useSidePanel,
  type PanelComponentProps,
  type SidePanelDescriptor,
  type SidePanelRegistry,
} from "@/components/side-panel";
import { dayKey, parseDayKey } from "@/lib/day-key";
import {
  derivePanelDescriptor,
  isKnownPanelKind,
  PANEL_ID_PARAM,
  PANEL_KINDS,
  PANEL_PARAM,
  withPanelParams,
  withoutPanelParams,
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

function PanelFallback() {
  return (
    <div
      className="h-32 animate-pulse motion-reduce:animate-none rounded-panel bg-muted/60"
      aria-hidden="true"
    />
  );
}

function CalendarDayPanel(props: PanelComponentProps) {
  return (
    <Suspense fallback={<PanelFallback />}>
      <CalendarDayPanelLazy {...props} />
    </Suspense>
  );
}

function CoinContextPanel(props: PanelComponentProps) {
  return (
    <Suspense fallback={<PanelFallback />}>
      <CoinContextPanelLazy {...props} />
    </Suspense>
  );
}

const PANEL_COMPONENTS: Record<keyof typeof PANEL_KINDS, PanelRegistryEntry> = {
  calendarDay: { component: CalendarDayPanel, title: "Day detail" },
  coinContext: { component: CoinContextPanel, title: "Coin market" },
};

const PANEL_REGISTRY: SidePanelRegistry = {
  [PANEL_KINDS.calendarDay.kind]: PANEL_COMPONENTS.calendarDay,
  [PANEL_KINDS.coinContext.kind]: PANEL_COMPONENTS.coinContext,
};

/** `useSearchParams` re-creates its setter on every search write; read the latest through a ref so actions stay stable. */
function useSearchParamsSetter() {
  const [, setSearchParams] = useSearchParams();
  const ref = useRef(setSearchParams);

  useEffect(() => {
    ref.current = setSearchParams;
  }, [setSearchParams]);

  return ref;
}

function useOpenPanel(): (kind: string, id: string) => void {
  const setSearchParamsRef = useSearchParamsSetter();

  return useCallback(
    (kind: string, id: string) => {
      setSearchParamsRef.current((current) => withPanelParams(current, kind, id), {
        replace: true,
      });
    },
    [setSearchParamsRef],
  );
}

function usePanelClose(): () => void {
  const setSearchParamsRef = useSearchParamsSetter();

  return useCallback(() => {
    setSearchParamsRef.current((current) => withoutPanelParams(current), { replace: true });
  }, [setSearchParamsRef]);
}

interface PanelActions {
  openPanel: (kind: string, id: string) => void;
  closePanel: () => void;
}

const NO_PANEL_ACTIONS: PanelActions = {
  openPanel: () => {},
  closePanel: () => {},
};

const PanelActionsContext = createContext<PanelActions>(NO_PANEL_ACTIONS);

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

/** Action-only subscription: opening or closing the panel does not re-render the caller. */
export function useOpenCoin(): (coin: string) => void {
  const { openPanel } = useContext(PanelActionsContext);

  return useCallback(
    (coin: string) => {
      openPanel(PANEL_KINDS.coinContext.kind, coin);
    },
    [openPanel],
  );
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
