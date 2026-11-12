import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "react-router";

import { PANEL_KINDS, withPanelParams, withoutPanelParams } from "@/lib/side-panel-params";

export interface PanelActions {
  openPanel: (kind: string, id: string) => void;
  closePanel: () => void;
}

const NO_PANEL_ACTIONS: PanelActions = {
  openPanel: () => {},
  closePanel: () => {},
};

export const PanelActionsContext = createContext<PanelActions>(NO_PANEL_ACTIONS);

type PanelParamsUpdate = (params: URLSearchParams) => URLSearchParams;

/**
 * `useSearchParams`' setter changes identity on every search write. `navigate` is stable
 * across search-only writes, so the panel params are read from the browser at call time.
 */
function usePanelParamsWriter(): (update: PanelParamsUpdate) => void {
  const navigate = useNavigate();

  return useCallback(
    (update: PanelParamsUpdate) => {
      const next = update(new URLSearchParams(window.location.search));
      void navigate(`?${next}`, { replace: true });
    },
    [navigate],
  );
}

export function useOpenPanel(): (kind: string, id: string) => void {
  const writePanelParams = usePanelParamsWriter();

  return useCallback(
    (kind: string, id: string) => {
      writePanelParams((current) => withPanelParams(current, kind, id));
    },
    [writePanelParams],
  );
}

export function usePanelClose(): () => void {
  const writePanelParams = usePanelParamsWriter();

  return useCallback(() => {
    writePanelParams((current) => withoutPanelParams(current));
  }, [writePanelParams]);
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
