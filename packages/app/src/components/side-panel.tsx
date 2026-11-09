import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";

import { getIsSheetSnapshot, subscribeIsSheet } from "@/components/side-panel-sheet-store";
import { Button } from "@/components/ui/button";
import { ScrollEdge } from "@/components/surface/scroll-edge";
import { Surface } from "@/components/surface/surface";

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

/* Both overlays dismiss Escape in the capture phase and stop it there. */
const OPEN_OVERLAY_SELECTOR =
  '[data-slot="dialog-content"][data-open], [data-slot="modal-content"][data-open]';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function hasOpenOverlay() {
  return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

function useIsSheet() {
  return React.useSyncExternalStore(subscribeIsSheet, getIsSheetSnapshot, () => false);
}

const REGION_CLASS =
  "sticky top-0 flex shrink-0 self-start overflow-hidden transition-[opacity,transform] duration-[200ms] ease-out max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-(--z-side-panel) max-md:w-(--sidebar-w) max-md:min-w-0";

const REGION_OPEN_CLASS =
  "h-dvh w-(--sidebar-w) min-w-(--sidebar-min-w) p-2 opacity-100 max-md:h-dvh max-md:translate-x-0";

/* Close rides opacity + transform only; the sheet keeps its size while it slides out. */
const REGION_CLOSED_CLASS =
  "pointer-events-none h-0 w-0 min-w-0 p-0 opacity-0 max-md:h-dvh max-md:w-(--sidebar-w) max-md:translate-x-full";

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

interface PanelBodyProps {
  Comp: React.ComponentType<PanelComponentProps>;
  id: string;
  title: React.ReactNode;
  onClose: () => void;
}

function PanelBody({ Comp, id, title, onClose }: PanelBodyProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-inline p-panel">
        <div className="min-w-0 flex-1 truncate type-title font-semibold">{title}</div>
        <Button variant="ghost" size="icon" aria-label="Close panel" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-panel">
        <ScrollEdge />
        <Comp id={id} />
      </div>
    </>
  );
}

function SidePanelRegion({ id = DEFAULT_REGION_ID, title, className }: SidePanelRegionProps) {
  const { descriptor, isOpen, close, registry } = useSidePanel();
  const isSheet = useIsSheet();
  const regionRef = React.useRef<HTMLDivElement>(null);

  const closeRef = React.useRef(close);
  React.useEffect(() => {
    closeRef.current = close;
  }, [close]);

  React.useEffect(() => {
    if (!isOpen) return () => {};
    const opener =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    const region = regionRef.current;
    const shell = isSheet ? document.querySelector<HTMLElement>("[data-shell-content]") : null;
    shell?.setAttribute("inert", "");

    const focusable = () =>
      region === null ? [] : Array.from(region.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (isSheet) focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        // Escape belongs to an open overlay: the panel must outlive that dismissal.
        if (hasOpenOverlay()) return;
        closeRef.current();
        return;
      }
      if (!isSheet || event.key !== "Tab") return;
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
  }, [isOpen, isSheet]);

  const entry = descriptor ? registry[descriptor.kind] : undefined;
  const Comp = entry?.component;
  const resolvedTitle = title ?? entry?.title;
  const label = typeof resolvedTitle === "string" ? resolvedTitle : "Side panel";
  const modal = isOpen && isSheet;

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={close}
          className="scrim fixed inset-0 z-(--z-chrome) cursor-default md:hidden"
        />
      )}
      <div
        id={id}
        ref={regionRef}
        aria-hidden={!isOpen}
        className={cn(REGION_CLASS, isOpen ? REGION_OPEN_CLASS : REGION_CLOSED_CLASS)}
      >
        {isOpen && descriptor && Comp && (
          <Surface
            as="aside"
            tier="solid"
            material="solid"
            radius="panel"
            role={modal ? "dialog" : "complementary"}
            aria-modal={modal ? true : undefined}
            aria-label={label}
            className={cn("flex h-full w-full flex-col overflow-hidden", className)}
          >
            <PanelBody Comp={Comp} id={descriptor.id} title={resolvedTitle} onClose={close} />
          </Surface>
        )}
      </div>
    </>
  );
}

export { SidePanelProvider, SidePanelRegion, useSidePanel };
