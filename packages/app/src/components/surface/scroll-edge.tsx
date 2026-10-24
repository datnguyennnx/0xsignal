import type { JSX } from "react";

/** One per scroll container, first child inside the scroller (sticky needs the scrollport). */
export function ScrollEdge(): JSX.Element {
  return <div className="scroll-edge" aria-hidden="true" />;
}
