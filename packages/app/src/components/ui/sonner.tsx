"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useAppStore } from "@/stores/use-app-store";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import type { CSSProperties } from "react";

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useAppStore((s) => s.theme) ?? "system";
  const cssVars: CSSProperties & Record<`--${string}`, string> = {
    "--normal-bg": "var(--glass-bg)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--glass-border)",
    "--border-radius": "var(--radius)",
  };

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={cssVars}
      {...props}
    />
  );
};

export { Toaster };
