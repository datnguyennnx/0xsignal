"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import type { CSSProperties } from "react";

interface ToasterDefaults {
  /** Sonner's own class strings are the only styling hook it accepts per toast. */
  toastClassName?: string;
}

const Toaster = ({
  theme = "system",
  toastClassName = "tier-floating",
  ...props
}: ToasterProps & ToasterDefaults) => {
  const cssVars: CSSProperties & Record<`--${string}`, string> = {
    "--normal-text": "var(--popover-foreground)",
    "--border-radius": "var(--radius-overlay)",
    zIndex: "calc(var(--z-overlay) + 100)",
  };

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-icon" />,
        info: <InfoIcon className="size-icon" />,
        warning: <TriangleAlertIcon className="size-icon" />,
        error: <OctagonXIcon className="size-icon" />,
        loading: <Loader2Icon className="size-icon animate-spin" />,
      }}
      style={cssVars}
      toastOptions={{ classNames: { toast: toastClassName } }}
      {...props}
    />
  );
};

export { Toaster };
