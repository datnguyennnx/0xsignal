import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface/surface";

export interface PanelComponentProps {
  id: string;
  variant: "page" | "panel";
}

interface SidePanelRegistryEntry {
  component: React.ComponentType<PanelComponentProps>;
  title?: string;
}

export type SidePanelRegistry = Record<string, SidePanelRegistryEntry>;

export interface SidePanelDescriptor {
  kind: string;
  id: string;
  title?: string;
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
  className?: string;
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

function hasOpenOverlay() {
  return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

const REGION_CLASS =
  "sticky top-0 flex shrink-0 self-start overflow-hidden transition-[width,min-width,opacity,padding] duration-300 ease-in-out max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-[min(20rem,90vw)] max-md:min-w-0 max-md:transition-none";

const REGION_OPEN_CLASS =
  "h-dvh w-1/5 min-w-[280px] p-2 opacity-100 max-md:h-dvh max-md:animate-in max-md:fade-in-0 max-md:slide-in-from-right max-md:duration-200";

const REGION_CLOSED_CLASS = "pointer-events-none h-0 w-0 min-w-0 p-0 opacity-0 max-md:hidden";

function SidePanelProvider({
  registry,
  descriptor,
  onClose,
  children,
  className,
}: SidePanelProviderProps) {
  const value = React.useMemo<SidePanelContextValue>(
    () => ({ descriptor, isOpen: descriptor !== null, close: onClose, registry }),
    [descriptor, onClose, registry],
  );

  return (
    <SidePanelContext.Provider value={value}>
      <div className={cn("contents", className)}>{children}</div>
    </SidePanelContext.Provider>
  );
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

function SidePanelRegion({ id = DEFAULT_REGION_ID, title, className }: SidePanelRegionProps) {
  const { descriptor, isOpen, close, registry } = useSidePanel();

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Escape belongs to an open overlay: the panel must outlive that dismissal.
      if (hasOpenOverlay()) return;
      closeRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [isOpen]);

  const entry = descriptor ? registry[descriptor.kind] : undefined;
  const Comp = entry?.component;
  const resolvedTitle = title ?? entry?.title ?? descriptor?.title;
  const label = typeof resolvedTitle === "string" ? resolvedTitle : "Side panel";

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={close}
          className="scrim fixed inset-0 z-30 cursor-default md:hidden"
        />
      )}
      <div
        id={id}
        aria-hidden={!isOpen}
        className={cn(REGION_CLASS, isOpen ? REGION_OPEN_CLASS : REGION_CLOSED_CLASS)}
      >
        {isOpen && descriptor && Comp && (
          <Surface
            as="aside"
            tier="solid"
            radius="panel"
            aria-label={label}
            className={cn("flex h-full w-full flex-col overflow-hidden", className)}
          >
            <div className="flex items-center justify-between gap-2 p-4">
              <div className="min-w-0 flex-1 truncate font-bold">{resolvedTitle}</div>
              <Button variant="ghost" size="icon" aria-label="Close panel" onClick={close}>
                <XIcon />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Comp id={descriptor.id} variant="panel" />
            </div>
          </Surface>
        )}
      </div>
    </>
  );
}

export { SidePanelProvider, SidePanelRegion, useSidePanel };
