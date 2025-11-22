import { Exit, pipe } from 'effect';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Activity, AlertTriangle, Target, Zap } from 'lucide-react';
import { getSignals } from '../lib/api';
import { useEffect_ } from '../lib/runtime';

export function TradingSignals() {
  const exit = useEffect_(() => getSignals(), []);

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY':
        return 'bg-green-500/20 border-green-500/40 text-green-400';
      case 'BUY':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'SELL':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'STRONG_SELL':
        return 'bg-red-500/20 border-red-500/40 text-red-400';
      default:
        return 'bg-white/5 border-white/10 text-white/60';
    }
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY':
      case 'BUY':
        return <TrendingUp className="w-5 h-5" />;
      case 'SELL':
      case 'STRONG_SELL':
        return <TrendingDown className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'PRICE_SPIKE':
        return <TrendingUp className="w-4 h-4" />;
      case 'VOLUME_SURGE':
        return <Activity className="w-4 h-4" />;
      case 'ATH_APPROACH':
        return <Target className="w-4 h-4" />;
      case 'VOLATILITY_SPIKE':
        return <Zap className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (!exit) {
    return <div className="text-center py-20 text-white/40">Loading trading signals...</div>;
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Trading Signals</h1>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            Failed to load signals. Please try again.
          </div>
        </div>
      ),
      onSuccess: (signals) => {
        // Filter and categorize signals
        const strongBuySignals = signals.filter((s: any) => s.recommendation === 'STRONG_BUY');
        const buySignals = signals.filter((s: any) => s.recommendation === 'BUY');
        const sellSignals = signals.filter((s: any) => s.recommendation === 'SELL');
        const strongSellSignals = signals.filter((s: any) => s.recommendation === 'STRONG_SELL');
        const highConfidence = signals.filter((s: any) => 
          s.quantAnalysis?.confidence >= 70
        );

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Trading Signals</h1>
                <p className="text-white/40 text-sm mt-1">
                  Actionable signals based on quantitative analysis
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

            {/* Signal Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/40 text-xs mb-2">Total Signals</div>
                <div className="text-2xl font-bold">{signals.length}</div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="text-green-400/60 text-xs mb-2">Strong Buy</div>
                <div className="text-2xl font-bold text-green-400">{strongBuySignals.length}</div>
              </div>

              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                <div className="text-green-400/60 text-xs mb-2">Buy</div>
                <div className="text-2xl font-bold text-green-400">{buySignals.length}</div>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <div className="text-red-400/60 text-xs mb-2">Sell</div>
                <div className="text-2xl font-bold text-red-400">{sellSignals.length}</div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="text-red-400/60 text-xs mb-2">Strong Sell</div>
                <div className="text-2xl font-bold text-red-400">{strongSellSignals.length}</div>
              </div>
            </div>

            {/* High Confidence Signals */}
            {highConfidence.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-xl font-bold">High Confidence Signals</h2>
                  <span className="text-sm text-white/40">({highConfidence.length})</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {highConfidence.slice(0, 4).map((signal: any) => (
                    <div
                      key={signal.symbol}
                      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold uppercase">{signal.symbol}</h3>
                          <p className="text-sm text-white/40 mt-1">
                            Confidence: {signal.quantAnalysis?.confidence}%
                          </p>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getRecommendationColor(signal.recommendation)}`}>
                          {getRecommendationIcon(signal.recommendation)}
                          <span className="font-bold">{signal.recommendation}</span>
                        </div>
                      </div>

                      {/* Quantitative Metrics */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-black/30 rounded-lg p-3">
                          <div className="text-xs text-white/40 mb-1">RSI</div>
                          <div className={`text-lg font-bold font-mono ${
                            signal.quantAnalysis?.rsiDivergence?.rsi > 70 ? 'text-red-400' :
                            signal.quantAnalysis?.rsiDivergence?.rsi < 30 ? 'text-green-400' :
                            'text-white'
                          }`}>
                            {signal.quantAnalysis?.rsiDivergence?.rsi?.toFixed(1) || 'N/A'}
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            {signal.quantAnalysis?.rsiDivergence?.signal || 'NEUTRAL'}
                          </div>
                        </div>

                        <div className="bg-black/30 rounded-lg p-3">
                          <div className="text-xs text-white/40 mb-1">Risk Score</div>
                          <div className={`text-lg font-bold font-mono ${
                            signal.combinedRiskScore > 70 ? 'text-red-400' :
                            signal.combinedRiskScore < 30 ? 'text-green-400' :
                            'text-yellow-400'
                          }`}>
                            {signal.combinedRiskScore || signal.bubbleScore}/100
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            {signal.bubbleAnalysis?.riskLevel || 'MEDIUM'}
                          </div>
                        </div>
                      </div>

                      {/* Bollinger Bands Info */}
                      {signal.quantAnalysis?.bollingerSqueeze && (
                        <div className="bg-black/30 rounded-lg p-3 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40">Bollinger Bands</span>
                            {signal.quantAnalysis.bollingerSqueeze.isSqueezing && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                                SQUEEZE
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-white/70">
                            Breakout: {signal.quantAnalysis.bollingerSqueeze.breakoutDirection}
                          </div>
                        </div>
                      )}

                      {/* Bubble Signals */}
                      {signal.bubbleAnalysis?.signals?.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <div className="text-xs text-white/40 mb-2">Detected Signals</div>
                          {signal.bubbleAnalysis.signals.slice(0, 3).map((sig: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <div className="text-white/50">{getSignalIcon(sig.signalType)}</div>
                              <span className="flex-1 text-white/70">
                                {sig.signalType.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs text-white/40 font-mono">
                                {sig.confidence}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Signals */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold">All Trading Signals</h2>
              
              {signals.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-20 text-center text-white/40">
                  No active signals detected
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {signals.map((signal: any) => (
                    <div
                      key={signal.symbol}
                      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold uppercase">{signal.symbol}</h3>
                          <p className="text-sm text-white/40 mt-1">
                            Risk: {signal.combinedRiskScore || signal.bubbleScore}/100
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getRecommendationColor(signal.recommendation)}`}>
                          {signal.recommendation || 'HOLD'}
                        </span>
                      </div>

                      {/* Quick Metrics */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-xs">
                          <span className="text-white/40">RSI: </span>
                          <span className="text-white/70 font-mono">
                            {signal.quantAnalysis?.rsiDivergence?.rsi?.toFixed(0) || 'N/A'}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-white/40">Confidence: </span>
                          <span className="text-white/70 font-mono">
                            {signal.quantAnalysis?.confidence || 0}%
                          </span>
                        </div>
                      </div>

                      {/* Signal Type */}
                      <div className="text-xs text-white/40">
                        {signal.quantAnalysis?.overallSignal || 'NEUTRAL'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      },
    })
  );
}
