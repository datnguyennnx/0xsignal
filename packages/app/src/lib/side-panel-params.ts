import type { SidePanelDescriptor } from "@/components/side-panel";
import { CALENDAR_DAY_PANEL } from "@/lib/panel-kind";

interface PanelKindDefinition {
  kind: string;
  param: string;
  idParam: string;
}

const PANEL_QUERY = { param: "panel", idParam: "panelId" } as const;

/** Canonical side-panel kinds; each entry owns its query-param names. */
export const PANEL_KINDS = {
  calendarDay: { kind: CALENDAR_DAY_PANEL, ...PANEL_QUERY },
  coinContext: { kind: "coin", ...PANEL_QUERY },
} as const satisfies Record<string, PanelKindDefinition>;

export const PANEL_PARAM = PANEL_QUERY.param;
export const PANEL_ID_PARAM = PANEL_QUERY.idParam;

const KNOWN_PANEL_KINDS: ReadonlySet<string> = new Set(
  Object.values(PANEL_KINDS).map((panel) => panel.kind),
);

export function isKnownPanelKind(kind: string): boolean {
  return KNOWN_PANEL_KINDS.has(kind);
}

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
