import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Zap } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                <span className="text-black font-bold">0x</span>
              </div>
              <div>
                <span className="text-xl font-bold">0xSignal</span>
                <span className="text-xs text-white/40 ml-2">Quant Trading</span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/"
                className={`px-5 py-2 rounded-lg transition-all flex items-center gap-2 text-sm ${
                  isActive('/')
                    ? 'bg-white text-black'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Market Dashboard
              </Link>
              <Link
                to="/signals"
                className={`px-5 py-2 rounded-lg transition-all flex items-center gap-2 text-sm ${
                  isActive('/signals')
                    ? 'bg-white text-black'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Zap className="w-4 h-4" />
                Trading Signals
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8">{children}</main>
      
      {/* Footer with Quant Info */}
      <footer className="border-t border-white/10 bg-black/50 mt-12">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-white/40">
            <div>
              Powered by <span className="text-white/60 font-mono">Bollinger Bands</span> & <span className="text-white/60 font-mono">RSI</span>
            </div>
            <div>
              Data from CoinGecko API
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
