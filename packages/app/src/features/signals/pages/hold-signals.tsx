/**
 * Hold Signals Page - Card-based layout
 */

import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { getHoldSignals } from "@/core/utils/effect-memoization";
import { QueryLoading, QueryError, QueryEmpty } from "@/components/ui/query-state";
import { SignalTable } from "../components/signal-table";

export function AllHoldSignals() {
  const { data, isLoading, isError } = useEffectQuery(() => cachedTopAnalysis(100), []);

  if (isLoading)
    return <QueryLoading message="Loading hold signals" context="Analyzing neutral positions" />;
  if (isError || !data) return <QueryError title="Neutral Positions" />;

  const holdSignals = getHoldSignals(data);
  const highNoiseCount = holdSignals.filter((s) => (s.noise?.value ?? 0) > 60).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5 px-4 py-4 sm:px-6 sm:py-6">
      <header>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-muted-foreground">
          Neutral Positions
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {holdSignals.length} assets · {highNoiseCount} high noise
        </p>
      </header>
      {holdSignals.length === 0 ? (
        <QueryEmpty message="All assets have directional signals. No neutral positions detected." />
      ) : (
        <SignalTable signals={holdSignals} type="hold" />
      )}
    </div>
  );
}
