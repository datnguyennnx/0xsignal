import { useParams } from 'react-router-dom';
import { Effect, Exit, pipe } from 'effect';
import { getTopAnalysis } from '../lib/api';
import { useEffect_ } from '../lib/runtime';
import { cn } from '@/lib/utils';

const fetchAssetData = (symbol: string) => Effect.gen(function* () {
  const data = yield* getTopAnalysis(100);
  return data.find((a: any) => a.symbol.toLowerCase() === symbol.toLowerCase());
});

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const exit = useEffect_(() => fetchAssetData(symbol || ''), [symbol]);

  if (!exit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="max-w-6xl mx-auto">
          <div className="text-sm text-muted-foreground">Unable to load data</div>
        </div>
      ),
      onSuccess: (asset) => {
        if (!asset) {
          return (
            <div className="max-w-6xl mx-auto">
              <div className="text-sm text-muted-foreground">Asset not found</div>
            </div>
          );
        }

        const quant = asset.quantAnalysis;
        const price = asset.price;

        return (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{asset.symbol.toUpperCase()}</h1>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-4 gap-6">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="text-2xl font-semibold tabular-nums">
                  ${price?.price >= 1 
                    ? price?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : price?.price.toFixed(6)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">24h Change</div>
                <div className={cn(
                  'text-2xl font-semibold tabular-nums',
                  (price?.change24h || 0) > 0 ? 'text-success' : (price?.change24h || 0) < 0 ? 'text-destructive' : 'text-foreground'
                )}>
                  {(price?.change24h || 0) > 0 ? '+' : ''}{(price?.change24h || 0).toFixed(2)}%
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Volume 24h</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {(price?.volume24h || 0) >= 1_000_000_000 
                    ? `$${((price?.volume24h || 0) / 1_000_000_000).toFixed(2)}B`
                    : `$${((price?.volume24h || 0) / 1_000_000).toFixed(0)}M`}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Signal</div>
                <div className="text-2xl font-semibold">
                  {quant?.overallSignal || 'NEUTRAL'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {quant?.confidence || 0}% confidence
                </div>
              </div>
            </div>

            {/* Indicators */}
            <div className="space-y-6">
              {/* Momentum */}
              {quant?.compositeScores?.momentum && (
                <div className="space-y-4">
                  <h2 className="text-sm font-medium text-muted-foreground">Momentum</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">RSI</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {quant.compositeScores.momentum.rsi.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quant.compositeScores.momentum.rsi > 70 ? 'Overbought' :
                         quant.compositeScores.momentum.rsi < 30 ? 'Oversold' : 'Neutral'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Score</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {quant.compositeScores.momentum.score > 0 ? '+' : ''}{quant.compositeScores.momentum.score}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quant.compositeScores.momentum.signal}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Trend</div>
                      <div className="text-xl font-semibold">
                        {Math.abs(quant.compositeScores.momentum.score) > 50 ? 'Strong' :
                         Math.abs(quant.compositeScores.momentum.score) > 20 ? 'Moderate' : 'Weak'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quant.compositeScores.momentum.score > 0 ? 'Uptrend' : 'Downtrend'}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {quant.compositeScores.momentum.insight}
                  </p>
                </div>
              )}

              {/* Volatility */}
              {quant?.compositeScores?.volatility && (
                <div className="space-y-4 pt-6 border-t">
                  <h2 className="text-sm font-medium text-muted-foreground">Volatility</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Regime</div>
                      <div className="text-xl font-semibold">
                        {quant.compositeScores.volatility.regime}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Score</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {quant.compositeScores.volatility.score}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Movement</div>
                      <div className="text-xl font-semibold">
                        {quant.compositeScores.volatility.regime === 'EXTREME' || quant.compositeScores.volatility.regime === 'HIGH' ? 'Large' :
                         quant.compositeScores.volatility.regime === 'LOW' ? 'Small' : 'Moderate'}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {quant.compositeScores.volatility.insight}
                  </p>
                </div>
              )}

              {/* Mean Reversion */}
              {quant?.compositeScores?.meanReversion && (
                <div className="space-y-4 pt-6 border-t">
                  <h2 className="text-sm font-medium text-muted-foreground">Mean Reversion</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Percent B</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {(quant.compositeScores.meanReversion.percentB * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quant.compositeScores.meanReversion.percentB > 0.8 ? 'Upper Band' :
                         quant.compositeScores.meanReversion.percentB < 0.2 ? 'Lower Band' : 'Mid Range'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Signal</div>
                      <div className="text-xl font-semibold">
                        {quant.compositeScores.meanReversion.signal}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Score</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {quant.compositeScores.meanReversion.score}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {quant.compositeScores.meanReversion.insight}
                  </p>
                </div>
              )}

              {/* Risk */}
              <div className="space-y-4 pt-6 border-t">
                <h2 className="text-sm font-medium text-muted-foreground">Risk Assessment</h2>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Risk Score</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {asset.combinedRiskScore}/100
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {asset.combinedRiskScore > 70 ? 'High risk' :
                     asset.combinedRiskScore < 30 ? 'Low risk' : 'Moderate risk'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      },
    })
  );
}
