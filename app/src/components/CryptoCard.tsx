import type { CryptoPrice } from '@0xsignal/shared';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CryptoCardProps {
  crypto: CryptoPrice;
}

export function CryptoCard({ crypto }: CryptoCardProps) {
  const isPositive = crypto.change24h >= 0;
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold uppercase tracking-wider">
            {crypto.symbol}
          </h3>
          <p className="text-sm text-white/40 mt-1">
            ${crypto.price >= 1 ? crypto.price.toLocaleString() : crypto.price.toFixed(6)}
          </p>
        </div>
        
        <div className={`flex items-center gap-1 ${isPositive ? 'text-white' : 'text-white/60'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="font-mono">{Math.abs(crypto.change24h).toFixed(2)}%</span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Market Cap</span>
          <span className="font-mono">${(crypto.marketCap / 1e9).toFixed(2)}B</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Volume</span>
          <span className="font-mono">${(crypto.volume24h / 1e9).toFixed(2)}B</span>
        </div>
      </div>
    </div>
  );
}
