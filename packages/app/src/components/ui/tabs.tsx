"use client";

import { memo } from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation}
      data-orientation={orientation}
      className={cn("group/tabs flex gap-inline data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-control p-(--seg-inset) type-control text-muted-foreground group-data-horizontal/tabs:h-control group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:items-stretch data-[variant=line]:rounded-control",
  {
    variants: {
      variant: {
        default: "tier-well",
        line: "gap-1 tier-identity",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  "motion-control data-active:duration-(--duration-base) inline-flex min-w-0 flex-1 items-center justify-center gap-(--control-gap) border border-transparent px-(--control-px) font-medium whitespace-nowrap text-muted-foreground hover:text-foreground focus-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon)",
  {
    variants: {
      variant: {
        default:
          "h-[calc(100%-2*var(--seg-inset))] rounded-[calc(var(--radius-control)-var(--seg-inset))] data-active:bg-(--control-active-bg) data-active:shadow-[inset_0_1px_0_var(--control-active-rim),inset_0_0_0_1px_var(--border)]",
        text: "h-control flex-none rounded-none border-b-2 py-0 shadow-none data-active:border-b-info data-active:bg-transparent data-active:shadow-none cursor-pointer",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsTrigger({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.Tab.Props & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(
        "relative group-data-vertical/tabs:h-auto group-data-vertical/tabs:flex-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start data-active:text-foreground",
        tabsTriggerVariants({ variant }),
        className,
      )}
      {...props}
    />
  );
}

const TabsContent = memo(function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 type-body outline-none", className)}
      {...props}
    />
  );
});

export { Tabs, TabsList, TabsTrigger, TabsContent };
