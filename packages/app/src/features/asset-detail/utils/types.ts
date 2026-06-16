export interface LayoutItem {
  /** Unique identifier for the panel */
  i: string;
  /** Grid column position (0-indexed) */
  x: number;
  /** Grid row position (0-indexed) */
  y: number;
  /** Width in grid columns */
  w: number;
  /** Height in grid rows */
  h: number;
  /** Minimum width in grid columns */
  minW?: number;
  /** Minimum height in grid rows */
  minH?: number;
}

export interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
  panelNames?: Record<string, string>;
}

/** Side from which resize is being triggered */
export type ResizeHandleAxis = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
