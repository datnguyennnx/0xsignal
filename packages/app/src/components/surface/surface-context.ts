import { createContext } from "react";
import type { SurfaceFrame } from "./tiers";

/** Ancestor surface stack, outermost first; portals reset it to an empty array. */
export const SurfaceContext = createContext<readonly SurfaceFrame[]>([]);
