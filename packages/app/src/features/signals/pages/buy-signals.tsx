import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { getBuySignals } from "@/core/utils/effect-memoization";
import { QueryLoading, QueryError, QueryEmpty } from "@/components/query-state";
import { SignalTable } from "../components/signal-table";

// Backend full-list cache: benefits from any prior fetch (dashboard=130)
const fetchTopAnalysis = () => cachedTopAnalysis(100);

export function AllBuySignals() {
  const { data, isLoading, isError } = useEffectQuery(fetchTopAnalysis, []);

  if (isLoading)
    return <QueryLoading message="Loading buy signals" context="Analyzing bullish setups" />;
  if (isError || !data) return <QueryError title="Long Positions" />;

  const buySignals = getBuySignals(data);
  const strongCount = buySignals.filter((s) => s.overallSignal === "STRONG_BUY").length;

  return (
    <div className="container-fluid space-y-5 py-4 sm:py-6">
      <header>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Long Positions</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {buySignals.length} signals · {strongCount} strong
        </p>
      </header>
      {buySignals.length === 0 ? (
        <QueryEmpty message="No bullish setups detected. Market may be in a risk-off phase." />
      ) : (
        <SignalTable signals={buySignals} type="buy" />
      )}
    </div>
  );
}
