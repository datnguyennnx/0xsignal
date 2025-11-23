import { TokenIcon } from "@web3icons/react";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

interface CryptoIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export function CryptoIcon({ symbol, size = 32, className = "" }: CryptoIconProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
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

  return (
    <TokenIcon
      symbol={symbol.toLowerCase()}
      variant="branded"
      size={size}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
