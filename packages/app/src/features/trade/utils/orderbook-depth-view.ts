import type { CSSProperties } from "react";

export const HANDOFF_FADE_CLASS =
  "animate-in fade-in-0 duration-(--dur-fast) ease-out motion-reduce:animate-none";

const DEPTH_BAR_TRANSITION = "transform var(--dur-fast) var(--ease-out)";

export function withDepthTransition(style: CSSProperties): CSSProperties {
  return { ...style, transition: DEPTH_BAR_TRANSITION };
}

export function emptySideNotice(side: "bid" | "ask", levelCount: number): string | null {
  if (levelCount > 0) return null;
  return side === "ask" ? "No ask levels" : "No bid levels";
}
