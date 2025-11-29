// Crypto Icon - dynamically loads individual token icons

import { useState, useEffect, type ComponentType } from "react";
import { CircleHelp } from "lucide-react";

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

// Cache for loaded icon components
const iconCache = new Map<string, ComponentType<{ size?: number; className?: string }>>();

export function CryptoIcon({ symbol, size = 32, className = "" }: CryptoIconProps) {
  const [IconComponent, setIconComponent] = useState<ComponentType<{
    size?: number;
    className?: string;
  }> | null>(() => iconCache.get(symbol.toUpperCase()) ?? null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const upperSymbol = symbol.toUpperCase();

    // Already cached
    if (iconCache.has(upperSymbol)) {
      setIconComponent(() => iconCache.get(upperSymbol)!);
      return;
    }

    // Dynamically import the specific token icon
    import("@web3icons/react")
      .then((module) => {
        const iconName = `Token${upperSymbol}` as keyof typeof module;
        const Icon = module[iconName] as ComponentType<{ size?: number; className?: string }>;

        if (Icon) {
          iconCache.set(upperSymbol, Icon);
          setIconComponent(() => Icon);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        setHasError(true);
      });
  }, [symbol]);

  if (hasError || !IconComponent) {
    return <IconFallback size={size} className={className} />;
  }

  return <IconComponent size={size} className={className} />;
}
