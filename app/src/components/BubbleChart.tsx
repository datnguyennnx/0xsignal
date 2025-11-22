import { useMemo } from 'react';
import type { CryptoBubbleAnalysis } from '@0xsignal/shared';

interface BubbleChartProps {
  analyses: CryptoBubbleAnalysis[];
}

export function BubbleChart({ analyses }: BubbleChartProps) {
  const bubbles = useMemo(() => {
    const sorted = [...analyses].sort((a, b) => b.bubbleScore - a.bubbleScore);
    const count = sorted.length;
    
    return sorted.map((analysis, index) => {
      const angle = (index / count) * 2 * Math.PI;
      const radiusX = 38;
      const radiusY = 18;
      
      const x = 50 + Math.cos(angle) * radiusX;
      const y = 50 + Math.sin(angle) * radiusY;
      
      const size = 100;
      
      return {
        ...analysis,
        size,
        x,
        y,
      };
    });
  }, [analyses]);

  const getRiskOpacity = (riskLevel: string) => {
    switch (riskLevel) {
      case 'EXTREME': return 1;
      case 'HIGH': return 0.95;
      case 'MEDIUM': return 0.85;
      default: return 0.75;
    }
  };

  return (
    <div className="relative w-full h-[500px] flex items-center justify-center">
      <div className="relative w-full h-full">
        {bubbles.map((bubble) => (
          <div
            key={bubble.symbol}
            className="absolute group transition-all duration-200 hover:scale-105 cursor-pointer"
            style={{
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="w-full h-full rounded-full bg-white transition-all"
              style={{ 
                opacity: getRiskOpacity(bubble.riskLevel),
              }}
            />
            
            <div className="absolute inset-0 flex flex-col items-center justify-center text-black pointer-events-none">
              <span className="text-xs font-bold uppercase tracking-wider">
                {bubble.symbol}
              </span>
              <span className="text-2xl font-bold mt-0.5">
                {bubble.bubbleScore}
              </span>
            </div>
            
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 
              transition-opacity bg-black border border-white/20 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap z-10">
              <div className="font-bold mb-1">{bubble.symbol.toUpperCase()}</div>
              <div className="text-white/60">Risk: {bubble.riskLevel}</div>
              <div className="text-white/60">Score: {bubble.bubbleScore}/100</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="absolute bottom-4 left-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white opacity-75" />
          <span className="text-white/50">Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white opacity-85" />
          <span className="text-white/50">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white opacity-95" />
          <span className="text-white/50">High</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white" />
          <span className="text-white/50">Extreme</span>
        </div>
      </div>
    </div>
  );
}
