import type { JSX } from "react";

/** Paint lives in `.ambient-canvas`; this node only anchors the layer behind content. */
export function AmbientCanvas(): JSX.Element {
  return (
    <div className="ambient-canvas pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />
  );
}
