"use client";

import { useContext } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "cn";
import { SurfaceContext } from "@/components/surface/surface-context";
import { surfaceAttrs } from "@/components/surface/tiers";

/** A portalled overlay is not nested in the page's surfaces, whatever triggered it. */
const PORTAL_ANCESTORS = [] as const;

/** Must clear a dialog popup through realistic nesting. */
const POPOVER_LAYER = "calc(var(--z-overlay) + 90)";

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  const depth = useContext(SurfaceContext).length;
  const surface = surfaceAttrs({
    tier: "floating",
    material: depth > 0 ? "plate" : "glass",
    depth,
  });

  return (
    <TooltipPrimitive.Portal>
      <SurfaceContext.Provider value={PORTAL_ANCESTORS}>
        <TooltipPrimitive.Positioner
          align={align}
          alignOffset={alignOffset}
          side={side}
          sideOffset={sideOffset}
          className="isolate"
          style={{ zIndex: POPOVER_LAYER }}
        >
          <TooltipPrimitive.Popup
            data-slot="tooltip-content"
            {...surface}
            className={cn(
              surface.className,
              "z-50 inline-flex w-fit max-w-[clamp(14rem,18vw,24rem)] origin-(--transform-origin) items-center gap-(--control-gap) rounded-control px-2 py-1 type-data text-popover-foreground has-data-[slot=kbd]:pr-1 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-chip data-open:duration-[150ms] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:duration-[100ms] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className,
            )}
            {...props}
          >
            {children}
            <TooltipPrimitive.Arrow
              className={cn(
                "z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5",
                depth > 0 ? "fill-(--plate-fill)" : "fill-(--tier-floating-fill)",
              )}
            />
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </SurfaceContext.Provider>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
