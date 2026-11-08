"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useAppStore } from "@/stores/use-app-store";
import { TIER_CLASS } from "@/components/surface/tiers";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import type { CSSProperties } from "react";

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useAppStore((s) => s.theme);
  const systemTheme = useAppStore((s) => s.systemTheme);
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const cssVars: CSSProperties & Record<`--${string}`, string> = {
    "--normal-text": "var(--popover-foreground)",
    "--border-radius": "var(--radius-overlay)",
    zIndex: "calc(var(--z-overlay) + 100)",
  };

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-icon" />,
        info: <InfoIcon className="size-icon" />,
        warning: <TriangleAlertIcon className="size-icon" />,
        error: <OctagonXIcon className="size-icon" />,
        loading: <Loader2Icon className="size-icon animate-spin" />,
      }}
      style={cssVars}
      // Sonner only accepts class strings per toast, so the tier is applied by its constant.
      toastOptions={{ classNames: { toast: TIER_CLASS.floating } }}
      {...props}
    />
  );
};

export { Toaster };
