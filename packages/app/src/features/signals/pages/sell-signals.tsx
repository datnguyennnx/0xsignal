import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { getSellSignals } from "@/core/utils/effect-memoization";
import { QueryLoading, QueryError, QueryEmpty } from "@/components/query-state";
import { SignalTable } from "../components/signal-table";

const fetchTopAnalysis = () => cachedTopAnalysis(100);

export function AllSellSignals() {
  const { data, isLoading, isError } = useEffectQuery(fetchTopAnalysis, []);

  if (isLoading)
    return <QueryLoading message="Loading sell signals" context="Analyzing bearish setups" />;
  if (isError || !data) return <QueryError title="Short Positions" />;

  const sellSignals = getSellSignals(data);
  const strongCount = sellSignals.filter((s) => s.overallSignal === "STRONG_SELL").length;

  return (
    <div className="container-fluid space-y-5 py-4 sm:py-6">
      <header>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Short Positions</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {sellSignals.length} signals · {strongCount} strong
        </p>
      </header>
      {sellSignals.length === 0 ? (
        <QueryEmpty message="No bearish setups detected. Market may be in a risk-on phase." />
      ) : (
        <SignalTable signals={sellSignals} type="sell" />
      )}
    </div>
  );
}
