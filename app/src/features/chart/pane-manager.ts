// Pane Manager - Effect-TS approach
import { Effect, Data } from "effect";
import type { IChartApi, ISeriesApi } from "lightweight-charts";

// ============================================================================
// ERRORS
// ============================================================================

export class PaneNotFoundError extends Data.TaggedError("PaneNotFoundError")<{
  readonly paneIndex: number;
}> {}

export class SeriesNotFoundError extends Data.TaggedError("SeriesNotFoundError")<{
  readonly seriesId: string;
}> {}

// ============================================================================
// PANE OPERATIONS
// ============================================================================

/**
 * Get pane by index
 */
export const getPane = (chart: IChartApi, paneIndex: number) =>
  Effect.try({
    try: () => {
      const panes = chart.panes();
      const pane = panes[paneIndex];
      if (!pane) {
        throw new PaneNotFoundError({ paneIndex });
      }
      return pane;
    },
    catch: (error) => {
      if (error instanceof PaneNotFoundError) return error;
      return new PaneNotFoundError({ paneIndex });
    },
  });

/**
 * Set pane height
 */
export const setPaneHeight = (chart: IChartApi, paneIndex: number, height: number) =>
  Effect.gen(function* () {
    const pane = yield* getPane(chart, paneIndex);
    yield* Effect.sync(() => pane.setHeight(height));
    return pane;
  });

/**
 * Move pane to position
 */
export const movePaneToIndex = (chart: IChartApi, fromIndex: number, toIndex: number) =>
  Effect.gen(function* () {
    const pane = yield* getPane(chart, fromIndex);
    yield* Effect.sync(() => pane.moveTo(toIndex));
    return pane;
  });

/**
 * Remove pane
 */
export const removePane = (chart: IChartApi, paneIndex: number) =>
  Effect.sync(() => chart.removePane(paneIndex));

/**
 * Get all panes
 */
export const getAllPanes = (chart: IChartApi) => Effect.sync(() => chart.panes());

// ============================================================================
// PANE CONFIGURATION
// ============================================================================

export interface PaneConfig {
  readonly index: number;
  readonly height?: number;
  readonly position?: number;
}

/**
 * Configure pane with height and position
 */
export const configurePane = (chart: IChartApi, config: PaneConfig) =>
  Effect.gen(function* () {
    const pane = yield* getPane(chart, config.index);

    if (config.height !== undefined) {
      yield* Effect.sync(() => pane.setHeight(config.height));
    }

    if (config.position !== undefined) {
      yield* Effect.sync(() => pane.moveTo(config.position));
    }

    return pane;
  });

// ============================================================================
// PANE PRESETS
// ============================================================================

export const PANE_PRESETS = {
  MAIN: { index: 0, height: 400 },
  RSI: { index: 1, height: 120 },
  MACD: { index: 2, height: 120 },
  VOLUME: { index: 3, height: 100 },
} as const;

/**
 * Setup standard pane layout
 */
export const setupStandardLayout = (chart: IChartApi) =>
  Effect.gen(function* () {
    // Main pane is always index 0
    const mainPane = yield* getPane(chart, 0);
    yield* Effect.sync(() => mainPane.setHeight(400));

    return { mainPane };
  });
