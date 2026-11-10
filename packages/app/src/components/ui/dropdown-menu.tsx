"use client";

import { useContext } from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import { SurfaceContext } from "@/components/surface/surface-context";
import { surfaceAttrs } from "@/components/surface/tiers";
import { CheckIcon } from "lucide-react";

/** A portalled overlay is not nested in the page's surfaces, whatever triggered it. */
const PORTAL_ANCESTORS = [] as const;

/** Must clear a dialog popup through realistic nesting. */
const POPOVER_LAYER = "calc(var(--z-overlay) + 90)";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  children,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  const depth = useContext(SurfaceContext).length;
  const surface = surfaceAttrs({
    tier: "floating",
    material: depth > 0 ? "plate" : "glass",
    depth,
  });

  return (
    <MenuPrimitive.Portal>
      <SurfaceContext.Provider value={PORTAL_ANCESTORS}>
        <MenuPrimitive.Positioner
          className="isolate outline-none"
          style={{ zIndex: POPOVER_LAYER }}
          align={align}
          alignOffset={alignOffset}
          side={side}
          sideOffset={sideOffset}
        >
          <MenuPrimitive.Popup
            data-slot="dropdown-menu-content"
            {...surface}
            className={cn(
              surface.className,
              "z-50 max-h-(--available-height) w-(--anchor-width) min-w-(--popover-min-w) overflow-x-hidden overflow-y-auto rounded-overlay p-1 type-body text-popover-foreground outline-none data-open:duration-[200ms] data-open:animate-in data-open:fade-in-0 data-closed:duration-[140ms] data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0",
              className,
            )}
            {...props}
          >
            {children}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </SurfaceContext.Provider>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex h-control cursor-default items-center gap-(--control-gap) rounded-control px-(--control-px) type-body focus-ring-inset select-none data-[highlighted]:bg-(--control-hover-bg) data-[highlighted]:text-foreground not-data-[variant=destructive]:data-[highlighted]:**:text-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon) data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex h-control cursor-default items-center gap-(--control-gap) rounded-control py-0 pr-8 pl-(--control-px) type-body focus-ring-inset select-none data-[highlighted]:bg-(--control-hover-bg) data-[highlighted]:text-foreground data-[highlighted]:**:text-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon)",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
};
