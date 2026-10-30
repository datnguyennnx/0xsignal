import type { SidePanelDescriptor } from "@/components/side-panel";

export const PANEL_PARAM = "panel";
export const PANEL_ID_PARAM = "panelId";

export function derivePanelDescriptor(
  params: URLSearchParams,
  isKnownKind: (kind: string) => boolean,
): SidePanelDescriptor | null {
  const kind = params.get(PANEL_PARAM);
  const id = params.get(PANEL_ID_PARAM);
  if (kind === null || kind === "" || id === null || id === "") return null;
  if (!isKnownKind(kind)) return null;
  return { kind, id };
}

export function withPanelParams(
  params: URLSearchParams,
  kind: string,
  id: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(PANEL_PARAM, kind);
  next.set(PANEL_ID_PARAM, id);
  return next;
}

export function withoutPanelParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(PANEL_PARAM);
  next.delete(PANEL_ID_PARAM);
  return next;
}
