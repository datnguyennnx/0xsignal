import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { ScrollEdge } from "@/components/surface/scroll-edge";
import { Surface } from "@/components/surface/surface";

import type { PanelComponentProps } from "@/components/side-panel";

interface PanelBodyProps {
  Comp: React.ComponentType<PanelComponentProps>;
  id: string;
  title: React.ReactNode;
  onClose: () => void;
}

export function PanelBody({ Comp, id, title, onClose }: PanelBodyProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-inline p-panel">
        <h2 className="min-w-0 flex-1 truncate type-title font-semibold">{title}</h2>
        <Button variant="dismiss" size="icon" aria-label="Close panel" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-panel">
        <ScrollEdge />
        <Comp id={id} />
      </div>
    </>
  );
}

export function SidePanelScrim({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      onClick={onClose}
      className="scrim fixed inset-0 z-(--z-chrome) cursor-default md:hidden"
    />
  );
}

interface SidePanelSurfaceProps {
  isSheet: boolean;
  modal: boolean;
  label: string;
  className: string | undefined;
  Comp: React.ComponentType<PanelComponentProps>;
  id: string;
  title: React.ReactNode;
  onClose: () => void;
}

export function SidePanelSurface({
  isSheet,
  modal,
  label,
  className,
  Comp,
  id,
  title,
  onClose,
}: SidePanelSurfaceProps) {
  const surfaceClassName = cn("flex h-full w-full flex-col overflow-hidden", className);
  const commonProps = {
    as: "aside",
    radius: "panel",
    role: modal ? "dialog" : "complementary",
    "aria-modal": modal ? true : undefined,
    "aria-label": label,
    className: surfaceClassName,
  } as const;

  if (isSheet) {
    return (
      <Surface tier="floating" material="glass" {...commonProps}>
        <PanelBody Comp={Comp} id={id} title={title} onClose={onClose} />
      </Surface>
    );
  }

  return (
    <Surface tier="solid" material="solid" {...commonProps}>
      <PanelBody Comp={Comp} id={id} title={title} onClose={onClose} />
    </Surface>
  );
}
