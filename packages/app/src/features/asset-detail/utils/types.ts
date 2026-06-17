export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
  panelNames?: Record<string, string>;
}

export type ResizeHandleAxis = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
