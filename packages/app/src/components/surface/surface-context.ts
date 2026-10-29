import { createContext } from "react";
import type { Tier } from "./tiers";

/** Ancestor tier stack, nearest last. Read by nested surfaces for placement checks. */
export const SurfaceContext = createContext<readonly Tier[]>([]);
