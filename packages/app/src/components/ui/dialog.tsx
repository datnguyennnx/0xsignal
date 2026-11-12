import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { SurfaceContext } from "@/components/surface/surface-context";
import { surfaceAttrs } from "@/components/surface/tiers";
import { withViewTransition } from "@/lib/view-transition";
import { XIcon } from "lucide-react";
import { PORTAL_ANCESTORS, overlayZ } from "./overlay-layer";

type DialogOpenChange = NonNullable<DialogPrimitive.Root.Props["onOpenChange"]>;

type DialogRuntime = {
  /** 0 for the page's dialog, +1 per nested modal: it drives both layer and morph. */
  depth: number;
};

const DialogRuntimeContext = React.createContext<DialogRuntime | null>(null);

type LayeredStyle<S> =
  | React.CSSProperties
  | ((state: S) => React.CSSProperties | undefined)
  | undefined;

/** A caller style may be a state function: the layer must outrank whatever it returns. */
function withLayer<S>(style: LayeredStyle<S>, zIndex: number | string) {
  if (typeof style === "function") return (state: S) => ({ ...style(state), zIndex });
  return { ...style, zIndex };
}

function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: DialogPrimitive.Root.Props) {
  const parent = React.useContext(DialogRuntimeContext);
  const depth = parent === null ? 0 : parent.depth + 1;

  const handleOpenChange = React.useCallback<DialogOpenChange>(
    (next, eventDetails) => {
      const apply = () => onOpenChange?.(next, eventDetails);
      // Only opening morphs; closing keeps its exit animation so focus returns at once.
      if (next && depth === 0) withViewTransition(apply);
      else apply();
    },
    [depth, onOpenChange],
  );

  const runtime = React.useMemo<DialogRuntime>(() => ({ depth }), [depth]);

  return (
    <DialogRuntimeContext.Provider value={runtime}>
      <DialogPrimitive.Root
        data-slot="dialog"
        {...props}
        // Controlled only when the caller owns `open`; otherwise Base UI holds the state.
        {...(open === undefined ? { defaultOpen } : { open })}
        onOpenChange={handleOpenChange}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogRuntimeContext.Provider>
  );
}

function DialogPortal({ container, ...props }: DialogPrimitive.Portal.Props) {
  return (
    <DialogPrimitive.Portal
      data-slot="dialog-portal"
      // Body is the only parent with no transform, `contain`, `isolation` or `backdrop effects`.
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
        "fixed inset-0 isolate data-open:duration-[240ms] data-open:animate-in data-open:fade-in-0 data-closed:duration-[160ms] data-closed:animate-out data-closed:fade-out-0",
        // Nested is hit-target only: the parent scrim dims the page, with no blur of its own.
        !isNested && "bg-(--scrim)",
        className,
      )}
      style={withLayer(style, overlayZ(depth * 2))}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  layout = "dialog",
  showCloseButton = true,
  style,
  ...props
}: DialogPrimitive.Popup.Props & {
  /** Fixes size and material; `workspace` never renders the floating close X. */
  layout?: "dialog" | "workspace";
  showCloseButton?: boolean;
}) {
  const depth = React.useContext(DialogRuntimeContext)?.depth ?? 0;
  // A workspace lays out its own chrome edge-to-edge; a floating corner X would sit over that content.
  const canClose = showCloseButton && layout !== "workspace";
  // A nested modal must not reuse the `dialog` snapshot name: both would be captured into the top layer.
  const isNested = depth > 0;
  const { className: surfaceClass, ...surface } = surfaceAttrs(
    layout === "workspace"
      ? { tier: "floating", material: "plate", depth: PORTAL_ANCESTORS.length }
      : {
          tier: "floating",
          material: "glass",
          thickness: "thick",
          depth: PORTAL_ANCESTORS.length,
        },
  );

  return (
    <DialogPortal>
      <SurfaceContext.Provider value={PORTAL_ANCESTORS}>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-layout={layout}
          {...surface}
          className={cn(
            surfaceClass,
            "fixed inset-0 m-auto grid grid-rows-[auto_minmax(0,1fr)_auto] gap-panel overflow-hidden rounded-overlay p-panel type-body text-popover-foreground outline-none data-open:duration-[240ms] data-open:animate-in data-open:fade-in-0 data-closed:duration-[160ms] data-closed:animate-out data-closed:fade-out-0",
            // `inset-0` alone stretches a fixed box to the viewport; `h-fit` keeps it compact.
            // Sizing caps live in `styles/utilities.css` under `[data-layout]`.
            layout === "workspace" ? "h-(--workspace-h)" : "h-fit",
            !isNested && "[view-transition-name:dialog]",
            className,
          )}
          style={withLayer(style, overlayZ(depth * 2 + 1))}
          {...props}
        >
          {children}
          {canClose && (
            <DialogClose
              render={<Button variant="dismiss" className="absolute top-1 right-1" size="icon" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogClose>
          )}
        </DialogPrimitive.Popup>
      </SurfaceContext.Provider>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-inline pr-6", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-(--control-gap) border-t border-(--border-subtle) p-panel sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("type-title leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "type-body text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
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
  DialogTitle,
};
