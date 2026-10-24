import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Surface, SurfaceContext } from "@/components/surface/surface";
import { withViewTransition } from "@/lib/view-transition";
import { XIcon } from "lucide-react";

export const MODAL_CONTENT_CLASS = "overflow-hidden";

/** A portalled overlay is not nested in the page's surfaces, whatever triggered it. */
const PORTAL_ANCESTORS = [] as const;

type DialogOpenChange = NonNullable<DialogPrimitive.Root.Props["onOpenChange"]>;

function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const handleOpenChange = React.useCallback<DialogOpenChange>(
    (open, eventDetails) => {
      if (onOpenChange === undefined) return;
      // Opening is the hierarchy change worth morphing; closing keeps its own
      // exit animation so focus returns without waiting on a snapshot.
      if (!open) {
        onOpenChange(open, eventDetails);
        return;
      }
      withViewTransition(() => {
        onOpenChange(open, eventDetails);
      });
    },
    [onOpenChange],
  );

  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      {...props}
      {...(onOpenChange === undefined ? {} : { onOpenChange: handleOpenChange })}
    />
  );
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 scrim duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <SurfaceContext.Provider value={PORTAL_ANCESTORS}>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            // The popup morphs only inside the overlay container it already lives
            // in — never out of the page content that triggered it.
            "[view-transition-name:dialog] fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-[var(--radius-overlay,0.875rem)] bg-transparent p-4 text-sm text-popover-foreground duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <Surface
            tier="floating"
            radius="overlay"
            className="pointer-events-none absolute inset-0 -z-10"
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
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-[var(--radius-overlay,0.875rem)] border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
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
