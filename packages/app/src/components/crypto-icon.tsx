// Crypto Icon - Uses CoinGecko images with fallback

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { cn } from "@/core/utils/cn";

interface CryptoIconProps {
  symbol: string;
  image?: string;
  size?: number;
  className?: string;
}

function IconFallback({ size, className }: { size: number; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center rounded-full bg-muted", className)}
      style={{ width: size, height: size }}
    >
      <CircleHelp
        className="text-muted-foreground"
        style={{ width: size * 0.6, height: size * 0.6 }}
      />
    </div>
  );
}

export function CryptoIcon({ symbol, image, size = 32, className = "" }: CryptoIconProps) {
  const [hasError, setHasError] = useState(false);

  // If no image URL or error loading, show fallback
  if (!image || hasError) {
    return <IconFallback size={size} className={className} />;
  }

  return (
    <img
      src={image}
      alt={symbol}
      width={size}
      height={size}
      className={cn("rounded-full", className)}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
