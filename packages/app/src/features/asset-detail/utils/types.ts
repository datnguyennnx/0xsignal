export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface ResizeFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResizeLimits {
  minW: number;
  minH: number;
  minX: number;
  maxX: number;
  minY: number;
  maxRows: number;
}

export interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
}

export type ResizeHandleAxis = "nw" | "n" | "ne" | "e" | "sw" | "s" | "se" | "w";
