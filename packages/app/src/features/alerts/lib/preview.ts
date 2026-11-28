import { useMemo } from "react";
import { evaluate, initialState } from "@0xsignal/shared/alerts/index.ts";
import type { Rule } from "@0xsignal/shared/alerts/index.ts";

import { useCandleHistory } from "@/features/trade/hooks/use-candle-history";

const PREVIEW_INTERVAL = "1m";
const PREVIEW_CANDLE_LIMIT = 7 * 24 * 60;

type Preview = {
  fires: number[];
  count: number;
};

function emptyPreview(): Preview {
  return { fires: [], count: 0 };
}

/** Candle times and `now` are epoch milliseconds, matching the engine's clock. */
function previewPrice(
  draft: Rule,
  candles: { time: number; close: number }[],
  now: number,
): Preview {
  if (draft.kind !== "price") return emptyPreview();

  const fires: number[] = [];
  let state = initialState();

  for (const candle of candles) {
    if (candle.time > now) continue;
    const step = evaluate(draft, { kind: "price", value: candle.close }, candle.time, state);
    state = step.state;
    if (step.fire !== null) fires.push(step.fire.firedAt);
  }

  return { fires, count: fires.length };
}

function previewSymbol(draft: Rule | null): string {
  if (draft === null || draft.kind !== "price") return "";
  return draft.condition.subject.slice("price:".length);
}

/**
 * Replays the draft over the last seven days of one-minute closes.
 * `undefined` means the request is in flight; `null` means no history to check.
 */
export function usePricePreview(draft: Rule | null, enabled: boolean): number | null | undefined {
  const { data, isError, isPending } = useCandleHistory(
    previewSymbol(draft),
    PREVIEW_INTERVAL,
    PREVIEW_CANDLE_LIMIT,
    enabled && draft !== null,
  );

  return useMemo(() => {
    if (draft === null || isError) return null;
    if (data !== undefined && data.length > 0) {
      const candles = data.map(({ time, close }) => ({ time: time * 1000, close }));
      const last = candles.at(-1);
      return last === undefined ? null : previewPrice(draft, candles, last.time).count;
    }
    return isPending ? undefined : null;
  }, [draft, data, isError, isPending]);
}
