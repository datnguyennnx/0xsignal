import { type PointerEvent } from "react";
import { cn } from "cn";
import type { ResizeHandleAxis } from "../utils/types";
import { CORNER_HIT_BOX_PX } from "../hooks/use-resize-gesture";

/** SVG path for L-shaped corner bracket, oriented to the given corner */
function cornerBracketPath(axis: string): string {
  switch (axis) {
    case "nw":
      return "M6 6V2H2";
    case "ne":
      return "M2 6V2H6";
    case "sw":
      return "M6 2V6H2";
    case "se":
      return "M2 2V6H6";
    default:
      return "";
  }
}

interface CornerHandlesProps {
  activeCorner: ResizeHandleAxis;
  isResizing: boolean;
  onPointerDown: (axis: ResizeHandleAxis) => (e: PointerEvent<HTMLDivElement>) => void;
}

/** Drawn bracket size in px; the transparent padding around it is the grab area. */
const BRACKET_SIZE_PX = 10;

export function CornerHandles({ activeCorner, isResizing, onPointerDown }: CornerHandlesProps) {
  return (
    <div
      onPointerDown={onPointerDown(activeCorner)}
      style={{
        width: CORNER_HIT_BOX_PX,
        height: CORNER_HIT_BOX_PX,
        padding: (CORNER_HIT_BOX_PX - BRACKET_SIZE_PX) / 2,
      }}
      className={cn(
        "absolute z-10 touch-none transition-opacity duration-150",
        isResizing ? "opacity-100" : "opacity-60 hover:opacity-100",
        activeCorner.includes("w") ? "left-0" : "right-0",
        activeCorner.includes("n") ? "top-0" : "bottom-0",
        activeCorner === "nw" || activeCorner === "se"
          ? "cursor-nwse-resize"
          : "cursor-nesw-resize",
      )}
    >
      <svg
        viewBox="0 0 8 8"
        className="block w-2.5 h-2.5 text-muted-foreground/60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={cornerBracketPath(activeCorner)} />
      </svg>
    </div>
  );
}
