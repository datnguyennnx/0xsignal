"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-[var(--control-radius-md)] p-[3px] text-muted-foreground group-data-horizontal/tabs:h-[var(--control-h-md)] group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-[var(--control-radius-md)]",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        line: "gap-1 bg-transparent",
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

const tabsTriggerVariants = cva("", {
  variants: {
    variant: {
      default: "data-active:bg-foreground/5 data-active:shadow-[var(--shadow-e1)]",
      text: "flex-none rounded-[var(--control-radius-md)] border-0 px-[var(--control-px-md)] py-2 font-medium shadow-none text-muted-foreground hover:text-foreground/80 data-active:text-foreground dark:data-active:text-foreground bg-transparent dark:bg-transparent data-active:bg-transparent dark:data-active:bg-transparent data-active:shadow-none transition-colors cursor-pointer gap-[clamp(0.375rem,0.6vw,0.625rem)] data-active:after:absolute data-active:after:bottom-0 data-active:after:left-0 data-active:after:right-0 data-active:after:h-[2px] data-active:after:bg-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

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
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-[var(--control-radius-md)] border border-transparent px-[var(--control-px-xs)] py-0.5 text-[length:var(--control-text-md)] font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-[var(--control-px-xs)] has-data-[icon=inline-start]:pl-[var(--control-px-xs)] aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-[var(--shadow-e1)] group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:text-foreground dark:data-active:border-input",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        tabsTriggerVariants({ variant }),
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
