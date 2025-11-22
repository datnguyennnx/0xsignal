import { Progress } from '@/components/ui/progress';
import type { CryptoBubbleAnalysis } from '@0xsignal/shared';
import { TrendingUp, Activity, Target } from 'lucide-react';

interface SignalCardProps {
  analysis: CryptoBubbleAnalysis;
}

export function SignalCard({ analysis }: SignalCardProps) {
  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'PRICE_SPIKE': return <TrendingUp className="w-4 h-4" />;
      case 'VOLUME_SURGE': return <Activity className="w-4 h-4" />;
      case 'ATH_APPROACH': return <Target className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold uppercase tracking-wider">
          {analysis.symbol}
        </h3>
        <span className="text-sm text-white/40">{analysis.riskLevel}</span>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/40">Bubble Score</span>
            <span className="font-bold">{analysis.bubbleScore}/100</span>
          </div>
          <Progress 
            value={analysis.bubbleScore} 
            className="h-2"
          />
        </div>

        {analysis.signals.length > 0 && (
          <div className="space-y-2 pt-2">
            {analysis.signals.slice(0, 3).map((signal, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-3 text-sm"
              >
                <div className="text-white/60">
                  {getSignalIcon(signal.signalType)}
                </div>
                <span className="flex-1">
                  {signal.signalType.replace(/_/g, ' ')}
                </span>
                <span className="text-white/40 text-xs">
                  {signal.confidence}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
