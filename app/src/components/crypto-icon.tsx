// Crypto Icon - lazy loaded for performance

import { lazy, Suspense, useState } from "react";
import { CircleHelp } from "lucide-react";

// Lazy load the heavy web3icons library (19MB)
const TokenIcon = lazy(() =>
  import("@web3icons/react").then((module) => ({ default: module.TokenIcon }))
);

interface CryptoIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

function IconFallback({ size, className }: { size: number; className: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-muted ${className}`}
      style={{ width: size, height: size }}
    >
      <CircleHelp
        className="text-muted-foreground"
        style={{ width: size * 0.6, height: size * 0.6 }}
      />
    </div>
  );
}

export function CryptoIcon({ symbol, size = 32, className = "" }: CryptoIconProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <IconFallback size={size} className={className} />;
  }

  return (
    <Suspense fallback={<IconFallback size={size} className={className} />}>
      <TokenIcon
        symbol={symbol.toLowerCase()}
        variant="branded"
        size={size}
        className={className}
        onError={() => setHasError(true)}
      />
    </Suspense>
  );
}
