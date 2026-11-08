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
              "z-50 max-h-(--available-height) w-(--anchor-width) min-w-(--popover-min-w) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-overlay p-1 type-body text-popover-foreground duration-(--dur-exit) outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95",
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
        "group/dropdown-menu-item relative flex h-control cursor-default items-center gap-(--control-gap) rounded-control px-(--control-px) type-body focus-ring-inset select-none hover:bg-(--control-hover-bg) hover:text-foreground focus:bg-(--control-hover-bg) focus:text-foreground data-[highlighted]:bg-(--control-hover-bg) not-data-[variant=destructive]:hover:**:text-foreground not-data-[variant=destructive]:focus:**:text-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:hover:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon) data-[variant=destructive]:*:[svg]:text-destructive",
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
        "relative flex h-control cursor-default items-center gap-(--control-gap) rounded-control py-0 pr-8 pl-(--control-px) type-body focus-ring-inset select-none hover:bg-(--control-hover-bg) hover:text-foreground focus:bg-(--control-hover-bg) focus:text-foreground data-[highlighted]:bg-(--control-hover-bg) hover:**:text-foreground focus:**:text-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon)",
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
