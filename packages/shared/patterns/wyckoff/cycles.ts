import type { WyckoffCycle } from "./types";
import {
  WYCKOFF_TYPES,
  CYCLE_PHASE,
  CYCLE_DIRECTION,
  type CyclePhaseType,
  type CycleDirectionType,
} from "../constants";

export const getCyclePhase = (cycle: WyckoffCycle): CyclePhaseType => {
  switch (cycle) {
    case WYCKOFF_TYPES.CYCLE.ACCUMULATION:
    case WYCKOFF_TYPES.CYCLE.MARKUP:
      return CYCLE_PHASE.ACCUMULATION;
    case WYCKOFF_TYPES.CYCLE.DISTRIBUTION:
    case WYCKOFF_TYPES.CYCLE.MARKDOWN:
      return CYCLE_PHASE.DISTRIBUTION;
    default:
      return CYCLE_PHASE.TRANSITION;
  }
};

export const isInAccumulation = (cycle: WyckoffCycle): boolean => {
  return cycle === WYCKOFF_TYPES.CYCLE.ACCUMULATION || cycle === WYCKOFF_TYPES.CYCLE.MARKUP;
};

export const isInDistribution = (cycle: WyckoffCycle): boolean => {
  return cycle === WYCKOFF_TYPES.CYCLE.DISTRIBUTION || cycle === WYCKOFF_TYPES.CYCLE.MARKDOWN;
};

export const getCycleDirection = (cycle: WyckoffCycle): CycleDirectionType => {
  switch (cycle) {
    case WYCKOFF_TYPES.CYCLE.MARKUP:
      return CYCLE_DIRECTION.UP;
    case WYCKOFF_TYPES.CYCLE.MARKDOWN:
      return CYCLE_DIRECTION.DOWN;
    default:
      return CYCLE_DIRECTION.SIDEWAYS;
  }
};

export const detectCycleTransition = (
  previousCycle: WyckoffCycle,
  currentCycle: WyckoffCycle
): boolean => {
  if (previousCycle === WYCKOFF_TYPES.CYCLE.UNKNOWN || currentCycle === WYCKOFF_TYPES.CYCLE.UNKNOWN)
    return false;
  if (
    (previousCycle === WYCKOFF_TYPES.CYCLE.ACCUMULATION ||
      previousCycle === WYCKOFF_TYPES.CYCLE.MARKUP) &&
    (currentCycle === WYCKOFF_TYPES.CYCLE.DISTRIBUTION ||
      currentCycle === WYCKOFF_TYPES.CYCLE.MARKDOWN)
  ) {
    return true;
  }
  if (
    (previousCycle === WYCKOFF_TYPES.CYCLE.DISTRIBUTION ||
      previousCycle === WYCKOFF_TYPES.CYCLE.MARKDOWN) &&
    (currentCycle === WYCKOFF_TYPES.CYCLE.ACCUMULATION ||
      currentCycle === WYCKOFF_TYPES.CYCLE.MARKUP)
  ) {
    return true;
  }
  return false;
};
