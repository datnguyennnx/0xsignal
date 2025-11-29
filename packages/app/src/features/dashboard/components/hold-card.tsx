// Hold Card - React Compiler handles memoization

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";

interface HoldCardProps {
  readonly signal: AssetAnalysis;
}

export function HoldCard({ signal }: HoldCardProps) {
  const navigate = useNavigate();
  const change24h = signal.price?.change24h || 0;

  return (
    <button
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
      className="flex items-center gap-1.5 px-2 py-1 rounded border border-transparent hover:border-border/40 hover:bg-accent/30 transition-all"
    >
      <CryptoIcon symbol={signal.symbol} size={14} />
      <span className="font-mono text-xs text-muted-foreground">{signal.symbol.toUpperCase()}</span>
      <span
        className={cn("text-[10px] tabular-nums", change24h > 0 ? "text-gain/70" : "text-loss/70")}
      >
        {formatPercent(change24h)}
      </span>
    </button>
  );
}
