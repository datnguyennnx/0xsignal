import * as React from "react";
import { cn } from "cn";

import { getIsSheetSnapshot, subscribeIsSheet } from "@/components/side-panel-sheet-store";
import { isDialogOpen } from "@/components/ui/dialog-state";
import { SidePanelScrim, SidePanelSurface } from "@/components/side-panel-region-parts";

export interface PanelComponentProps {
  id: string;
}

interface SidePanelRegistryEntry {
  component: React.ComponentType<PanelComponentProps>;
  title?: string;
}

export type SidePanelRegistry = Record<string, SidePanelRegistryEntry>;

export interface SidePanelDescriptor {
  kind: string;
  id: string;
}

interface SidePanelContextValue {
  descriptor: SidePanelDescriptor | null;
  isOpen: boolean;
  close: () => void;
  registry: SidePanelRegistry;
}

interface SidePanelProviderProps {
  registry: SidePanelRegistry;
  descriptor: SidePanelDescriptor | null;
  onClose: () => void;
  children: React.ReactNode;
}

interface SidePanelRegionProps {
  id?: string;
  title?: React.ReactNode;
  className?: string;
}

const SidePanelContext = React.createContext<SidePanelContextValue | null>(null);

const DEFAULT_REGION_ID = "side-panel-region";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface FocusContainmentOptions {
  active: boolean;
  trapFocus: boolean;
  onDismiss: () => void;
}

/** Focus trap, inert shell, Escape and opener restore: the panel's only accessibility stack. */
function useFocusContainment<T extends HTMLElement>(
  regionRef: React.RefObject<T | null>,
  { active, trapFocus, onDismiss }: FocusContainmentOptions,
) {
  const dismissRef = React.useRef(onDismiss);
  React.useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  React.useEffect(() => {
    if (!active) return () => {};
    const region = regionRef.current;
    const opener =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    const shell = trapFocus ? document.querySelector<HTMLElement>("[data-shell-content]") : null;
    shell?.setAttribute("inert", "");

    const focusable = () =>
      region === null ? [] : Array.from(region.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (trapFocus) focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        // An open dialog owns the key: Base UI dismisses it and the panel outlives that dismissal.
        if (isDialogOpen()) return;
        dismissRef.current();
        return;
      }
      if (!trapFocus || event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      shell?.removeAttribute("inert");
      opener?.focus();
    };
  }, [active, trapFocus, regionRef]);
}

function useIsSheet() {
  return React.useSyncExternalStore(subscribeIsSheet, getIsSheetSnapshot, () => false);
}

const REGION_CLASS =
  "flex shrink-0 self-start overflow-hidden transition-[opacity,transform] duration-[200ms] ease-out";

const REGION_INLINE_CLASS = "sticky top-0";
const REGION_SHEET_CLASS =
  "fixed inset-y-0 right-0 z-(--z-side-panel) h-dvh w-(--sidebar-w) min-w-0";

const REGION_INLINE_OPEN_CLASS = "h-dvh w-(--sidebar-w) min-w-(--sidebar-min-w) p-2 opacity-100";
const REGION_SHEET_OPEN_CLASS = "translate-x-0 p-2 opacity-100";

/* Desktop removes the closed panel from flow; the sheet keeps its box and slides out. */
const REGION_INLINE_CLOSED_CLASS = "hidden";
const REGION_SHEET_CLOSED_CLASS = "pointer-events-none translate-x-full opacity-0";

function SidePanelProvider({ registry, descriptor, onClose, children }: SidePanelProviderProps) {
  const value = React.useMemo<SidePanelContextValue>(
    () => ({ descriptor, isOpen: descriptor !== null, close: onClose, registry }),
    [descriptor, onClose, registry],
  );

  return <SidePanelContext.Provider value={value}>{children}</SidePanelContext.Provider>;
}

function useSidePanel(): SidePanelContextValue {
  return (
    React.useContext(SidePanelContext) ?? {
      descriptor: null,
      isOpen: false,
      close: () => {},
      registry: {},
    }
  );
}

const REGION_POSITION_CLASS: Record<"inline" | "sheet", string> = {
  inline: REGION_INLINE_CLASS,
  sheet: REGION_SHEET_CLASS,
};

const REGION_VISIBILITY_CLASS: Record<"inline" | "sheet", Record<"open" | "closed", string>> = {
  inline: { open: REGION_INLINE_OPEN_CLASS, closed: REGION_INLINE_CLOSED_CLASS },
  sheet: { open: REGION_SHEET_OPEN_CLASS, closed: REGION_SHEET_CLOSED_CLASS },
};

/** The layout and visibility classes flip together with the sheet breakpoint. */
function useRegionClass(isSheet: boolean, isOpen: boolean): string {
  const layout = isSheet ? "sheet" : "inline";
  const visibility = isOpen ? "open" : "closed";
  return cn(
    REGION_CLASS,
    REGION_POSITION_CLASS[layout],
    REGION_VISIBILITY_CLASS[layout][visibility],
  );
}

function SidePanelRegion({ id = DEFAULT_REGION_ID, title, className }: SidePanelRegionProps) {
  const { descriptor, isOpen, close, registry } = useSidePanel();
  const isSheet = useIsSheet();
  const regionRef = React.useRef<HTMLDivElement>(null);
  const modal = isOpen && isSheet;

  useFocusContainment(regionRef, { active: isOpen, trapFocus: isSheet, onDismiss: close });

  const entry = descriptor ? registry[descriptor.kind] : undefined;
  const Comp = entry?.component;
  const resolvedTitle = title ?? entry?.title;
  const label = typeof resolvedTitle === "string" ? resolvedTitle : "Side panel";
  const regionClass = useRegionClass(isSheet, isOpen);

  return (
    <>
      <SidePanelScrim open={isOpen} onClose={close} />
      <div id={id} ref={regionRef} aria-hidden={!isOpen} className={regionClass}>
        {isOpen && descriptor && Comp && (
          <SidePanelSurface
            isSheet={isSheet}
            modal={modal}
            label={label}
            className={className}
            Comp={Comp}
            id={descriptor.id}
            title={resolvedTitle}
            onClose={close}
          />
        )}
      </div>
    </>
  );
}

export { SidePanelProvider, SidePanelRegion, useSidePanel };
