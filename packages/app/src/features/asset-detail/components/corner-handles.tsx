import { type PointerEvent } from "react";
import type { ResizeHandleAxis } from "../utils/types";

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

/** L-shaped SVG corner brackets for resize handles */
export function CornerHandles({ activeCorner, isResizing, onPointerDown }: CornerHandlesProps) {
  return (
    <div
      onPointerDown={onPointerDown(activeCorner)}
      className={`absolute z-10 ${
        isResizing ? "opacity-100" : "opacity-60 hover:opacity-100"
      } transition-opacity duration-150`}
      style={{
        touchAction: "none",
        [activeCorner.includes("w") ? "left" : "right"]: 4,
        [activeCorner.includes("n") ? "top" : "bottom"]: 4,
        cursor: activeCorner === "nw" || activeCorner === "se" ? "nwse-resize" : "nesw-resize",
      }}
    >
      <svg
        viewBox="0 0 8 8"
        className={`w-2.5 h-2.5 ${isResizing ? "text-neutral-400/50" : "text-neutral-500/25"}`}
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
