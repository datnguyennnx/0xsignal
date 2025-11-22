import { Effect, Exit, pipe } from 'effect';
import { Button } from '@/components/ui/button';
import { BubbleChart } from '../components/BubbleChart';
import { RefreshCw, TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { getTopAnalysis, getOverview } from '../lib/api';
import { useEffect_ } from '../lib/runtime';

const fetchDashboardData = () =>
  Effect.gen(function* () {
    const [analyses, overview] = yield* Effect.all([getTopAnalysis(20), getOverview()]);
    return { analyses, overview };
  });

export function MarketDashboard() {
  const exit = useEffect_(fetchDashboardData, []);

  if (!exit) {
    return <div className="text-center py-20 text-white/40">Loading market data...</div>;
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Market Dashboard</h1>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            Failed to load market data. Please try again.
          </div>
        </div>
      ),
      onSuccess: (data) => {
        const stats = {
          total: data.overview?.totalAnalyzed || 0,
          bubbles: data.overview?.bubblesDetected || 0,
          highRisk: data.overview?.highRiskAssets?.length || 0,
        };

        // Calculate market sentiment from analyses
        const bullishCount = data.analyses?.filter((a: any) => 
          a.quantAnalysis?.overallSignal === 'BUY' || a.quantAnalysis?.overallSignal === 'STRONG_BUY'
        ).length || 0;
        
        const bearishCount = data.analyses?.filter((a: any) => 
          a.quantAnalysis?.overallSignal === 'SELL' || a.quantAnalysis?.overallSignal === 'STRONG_SELL'
        ).length || 0;

        const marketSentiment = bullishCount > bearishCount ? 'BULLISH' : 
                               bearishCount > bullishCount ? 'BEARISH' : 'NEUTRAL';

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Market Dashboard</h1>
                <p className="text-white/40 text-sm mt-1">
                  Quantitative analysis with Bollinger Bands & RSI
                </p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                className="bg-white text-black hover:bg-white/90 h-10 px-5"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/40 text-xs mb-2">Assets Tracked</div>
                <div className="text-3xl font-bold">{stats.total}</div>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/40 text-xs mb-2">Market Sentiment</div>
                <div className={`text-2xl font-bold ${
                  marketSentiment === 'BULLISH' ? 'text-green-400' :
                  marketSentiment === 'BEARISH' ? 'text-red-400' : 'text-white/60'
                }`}>
                  {marketSentiment}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/40 text-xs mb-2">High Risk Assets</div>
                <div className="text-3xl font-bold text-red-400">{stats.highRisk}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/40 text-xs mb-2">Bubbles Detected</div>
                <div className="text-3xl font-bold text-orange-400">{stats.bubbles}</div>
              </div>
            </div>

            {/* Market Sentiment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <div className="text-white/60 text-sm">Bullish Signals</div>
                </div>
                <div className="text-3xl font-bold text-green-400">{bullishCount}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-white/60" />
                  <div className="text-white/60 text-sm">Neutral</div>
                </div>
                <div className="text-3xl font-bold">
                  {stats.total - bullishCount - bearishCount}
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  <div className="text-white/60 text-sm">Bearish Signals</div>
                </div>
                <div className="text-3xl font-bold text-red-400">{bearishCount}</div>
              </div>
            </div>

            {/* Bubble Chart */}
            {data.analyses && data.analyses.length > 0 && (
              <div className="bg-black border border-white/10 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">Risk vs Volatility Map</h2>
                <BubbleChart analyses={data.analyses} />
              </div>
            )}

            {/* Top Movers */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Top Market Movers (24h)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.analyses?.slice(0, 6).map((analysis: any) => (
                  <div
                    key={analysis.symbol}
                    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold uppercase">{analysis.symbol}</h3>
                        <p className="text-sm text-white/40 mt-1">
                          Risk: {analysis.combinedRiskScore || analysis.bubbleScore}/100
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        analysis.recommendation === 'STRONG_BUY' ? 'bg-green-500/20 text-green-400' :
                        analysis.recommendation === 'BUY' ? 'bg-green-500/10 text-green-400' :
                        analysis.recommendation === 'SELL' ? 'bg-red-500/10 text-red-400' :
                        analysis.recommendation === 'STRONG_SELL' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/5 text-white/60'
                      }`}>
                        {analysis.recommendation || 'HOLD'}
                      </span>
                    </div>

                    {/* Quant Indicators */}
                    {analysis.quantAnalysis && (
                      <div className="space-y-2 pt-3 border-t border-white/10">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">RSI</span>
                          <span className={`font-mono ${
                            analysis.quantAnalysis.rsiDivergence?.rsi > 70 ? 'text-red-400' :
                            analysis.quantAnalysis.rsiDivergence?.rsi < 30 ? 'text-green-400' :
                            'text-white/70'
                          }`}>
                            {analysis.quantAnalysis.rsiDivergence?.rsi?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">BB Squeeze</span>
                          <span className="text-white/70">
                            {analysis.quantAnalysis.bollingerSqueeze?.isSqueezing ? 'Yes' : 'No'}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">Signal</span>
                          <span className="text-white/70">
                            {analysis.quantAnalysis.overallSignal || 'NEUTRAL'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      },
    })
  );
}
