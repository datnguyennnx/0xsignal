import { jsx as _jsx } from "react/jsx-runtime";
// Crypto Icon - dynamically loads individual token icons
import { useState, useEffect } from "react";
import { CircleHelp } from "lucide-react";
function IconFallback({ size, className }) {
  return _jsx("div", {
    className: `flex items-center justify-center rounded-full bg-muted ${className}`,
    style: { width: size, height: size },
    children: _jsx(CircleHelp, {
      className: "text-muted-foreground",
      style: { width: size * 0.6, height: size * 0.6 },
    }),
  });
}
// Cache for loaded icon components
const iconCache = new Map();
export function CryptoIcon({ symbol, size = 32, className = "" }) {
  const [IconComponent, setIconComponent] = useState(
    () => iconCache.get(symbol.toUpperCase()) ?? null
  );
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const upperSymbol = symbol.toUpperCase();
    // Already cached
    if (iconCache.has(upperSymbol)) {
      setIconComponent(() => iconCache.get(upperSymbol));
      return;
    }
    // Dynamically import the specific token icon
    import("@web3icons/react")
      .then((module) => {
        const iconName = `Token${upperSymbol}`;
        const Icon = module[iconName];
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
    return _jsx(IconFallback, { size: size, className: className });
  }
  return _jsx(IconComponent, { size: size, className: className });
}
//# sourceMappingURL=crypto-icon.js.map
