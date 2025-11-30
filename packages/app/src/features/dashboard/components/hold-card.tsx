/**
 * Hold Card - Compact chip-style display
 * Uses shadcn Button for consistent interaction
 */

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { Button } from "@/components/ui/button";

interface HoldCardProps {
  readonly signal: AssetAnalysis;
}

export function HoldCard({ signal }: HoldCardProps) {
  const navigate = useNavigate();
  const change24h = signal.price?.change24h || 0;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
      className="h-7 px-2.5 gap-1.5 rounded-full"
    >
      <CryptoIcon symbol={signal.symbol} image={signal.price?.image} size={14} />
      <span className="font-mono text-xs">{signal.symbol.toUpperCase()}</span>
      <span className={cn("text-[10px] tabular-nums", change24h > 0 ? "text-gain" : "text-loss")}>
        {formatPercent(change24h)}
      </span>
    </Button>
  );
}
