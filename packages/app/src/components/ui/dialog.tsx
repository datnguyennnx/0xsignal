import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface/surface";
import { SurfaceContext } from "@/components/surface/surface-context";
import { withViewTransition } from "@/lib/view-transition";
import { XIcon } from "lucide-react";

export const MODAL_CONTENT_CLASS = "overflow-hidden";

/** A portalled overlay is not nested in the page's surfaces, whatever triggered it. */
const PORTAL_ANCESTORS = [] as const;

/** Above every piece of app chrome: header 50, mobile panel 40, save bar 100. */
const DIALOG_LAYER = 110;

type DialogOpenChange = NonNullable<DialogPrimitive.Root.Props["onOpenChange"]>;
type DialogOpenChangeDetails = Parameters<DialogOpenChange>[1];

/** What asked the dialog to close: `outside-press`, `escape-key`, `close-press`, … */
export type DialogDismissReason = DialogOpenChangeDetails["reason"];

type EscapeChangeDetails = Extract<DialogOpenChangeDetails, { reason: "escape-key" }>;

/** Base UI owns `cancel`/`allowPropagation` off this path: it only reports the gesture. */
function escapeChangeDetails(event: KeyboardEvent): EscapeChangeDetails {
  return {
    reason: "escape-key",
    event,
    cancel: () => {},
    allowPropagation: () => {},
    isCanceled: false,
    isPropagationAllowed: false,
    trigger: document.activeElement ?? undefined,
    preventUnmountOnClose: () => {},
  };
}

type DialogRuntime = {
  /** 0 for the page's dialog, +1 per nested modal: it drives both layer and morph. */
  depth: number;
  dismiss: (reason: DialogDismissReason, event: Event) => void;
};

type OpenDialog = Pick<DialogRuntime, "dismiss">;

const DialogRuntimeContext = React.createContext<DialogRuntime | null>(null);

/** Open dialogs in mount order: the last one is topmost, and only it owns Escape. */
const openDialogs: OpenDialog[] = [];

function isInsideOpenMenu(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('[data-slot="dropdown-menu-content"][data-open]') !== null
  );
}

type LayeredStyle<S> =
  | React.CSSProperties
  | ((state: S) => React.CSSProperties | undefined)
  | undefined;

/** A caller style may be a state function: the layer must outrank whatever it returns. */
function withLayer<S>(style: LayeredStyle<S>, zIndex: number) {
  if (typeof style === "function") return (state: S) => ({ ...style(state), zIndex });
  return { ...style, zIndex };
}

/** A modal stacks over the dialog: its own capture listener owns the key there. */
function isModalOpen() {
  return document.querySelector('[data-slot="modal-content"][data-open]') !== null;
}

function handleDocumentEscape(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  if (isModalOpen()) return;
  // A menu layered over the dialog keeps the key: its own dismissal runs first.
  if (isInsideOpenMenu(event.target)) return;
  const topmost = openDialogs.at(-1);
  if (topmost === undefined) return;
  event.stopPropagation();
  topmost.dismiss("escape-key", event);
}

let escapeListenerBound = false;

function syncEscapeListener() {
  const shouldBind = openDialogs.length > 0;
  if (shouldBind === escapeListenerBound) return;
  if (shouldBind) document.addEventListener("keydown", handleDocumentEscape, true);
  else document.removeEventListener("keydown", handleDocumentEscape, true);
  escapeListenerBound = shouldBind;
}

function Dialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: DialogPrimitive.Root.Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const openRef = React.useRef(open);

  const parent = React.useContext(DialogRuntimeContext);
  const depth = parent === null ? 0 : parent.depth + 1;

  const applyOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
    },
    [isControlled],
  );

  const handleOpenChange = React.useCallback<DialogOpenChange>(
    (next, eventDetails) => {
      openRef.current = next;
      const apply = () => {
        applyOpen(next);
        onOpenChange?.(next, eventDetails);
      };
      // Only opening morphs; closing keeps its exit animation so focus returns at once.
      if (next && depth === 0) withViewTransition(apply);
      else apply();
    },
    [applyOpen, depth, onOpenChange],
  );

  const dismiss = React.useCallback<DialogRuntime["dismiss"]>(
    (reason, event) => {
      if (!openRef.current) return;
      openRef.current = false;
      applyOpen(false);
      if (reason === "escape-key" && event instanceof KeyboardEvent) {
        onOpenChange?.(false, escapeChangeDetails(event));
      }
    },
    [applyOpen, onOpenChange],
  );

  // Stable identity: the stack is ordered by mount, never by re-render.
  const dismissRef = React.useRef(dismiss);
  React.useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  const [entry] = React.useState<OpenDialog>(() => ({
    dismiss: (reason, event) => {
      dismissRef.current(reason, event);
    },
  }));

  const runtime = React.useMemo<DialogRuntime>(() => ({ depth, dismiss }), [depth, dismiss]);

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  React.useEffect(() => {
    if (open) {
      openDialogs.push(entry);
      syncEscapeListener();
    }
    return () => {
      const index = openDialogs.lastIndexOf(entry);
      if (index !== -1) openDialogs.splice(index, 1);
      syncEscapeListener();
    };
  }, [open, entry]);

  return (
    <DialogRuntimeContext.Provider value={runtime}>
      <DialogPrimitive.Root
        data-slot="dialog"
        {...props}
        open={open}
        onOpenChange={handleOpenChange}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogRuntimeContext.Provider>
  );
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ container, ...props }: DialogPrimitive.Portal.Props) {
  return (
    <DialogPrimitive.Portal
      data-slot="dialog-portal"
      // Body is the only parent with no transform, `contain`, `isolation` or `backdrop-filter`.
      container={container ?? (typeof document === "undefined" ? undefined : document.body)}
      {...props}
    />
  );
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, style, ...props }: DialogPrimitive.Backdrop.Props) {
  const depth = React.useContext(DialogRuntimeContext)?.depth ?? 0;
  const isNested = depth > 0;

  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      // Base UI drops a nested backdrop; without it the press lands on the parent popup and never dismisses.
      forceRender={isNested}
      className={cn(
        "fixed inset-0 isolate duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        // Nested is hit-target only: the parent scrim dims the page, with no blur of its own.
        !isNested && "scrim",
        className,
      )}
      style={withLayer(style, DIALOG_LAYER + depth * 2)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  style,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  const depth = React.useContext(DialogRuntimeContext)?.depth ?? 0;
  // A nested modal must not reuse the `dialog` snapshot name: both would be captured into the top layer.
  const isNested = depth > 0;

  return (
    <DialogPortal>
      <SurfaceContext.Provider value={PORTAL_ANCESTORS}>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-[var(--radius-overlay)] bg-transparent p-4 text-sm text-popover-foreground duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            !isNested && "[view-transition-name:dialog]",
            className,
          )}
          style={withLayer(style, DIALOG_LAYER + depth * 2 + 1)}
          {...props}
        >
          <Surface
            tier="solid"
            radius="overlay"
            className="pointer-events-none absolute inset-0 -z-10 glass-no-specular"
          />
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </SurfaceContext.Provider>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-[var(--radius-overlay)] border-t bg-muted/60 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
