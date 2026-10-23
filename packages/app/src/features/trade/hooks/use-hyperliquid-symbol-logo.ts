import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const HYPERLIQUID_COIN_ICON_BASE = "https://app.hyperliquid.xyz/coins";

function normalizeSymbol(rawSymbol: string): string {
  return rawSymbol.trim().toUpperCase();
}

function getSymbolLogoCandidates(symbol: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (!normalized || normalized.startsWith("@")) return [];

  const candidates: string[] = [];
  const addCandidate = (value: string) => {
    const url = `${HYPERLIQUID_COIN_ICON_BASE}/${value}.svg`;
    if (!candidates.includes(url)) candidates.push(url);
  };

  if (normalized.includes(":")) {
    const [dex, ...coinParts] = normalized.split(":");
    if (dex && coinParts.length > 0) {
      addCandidate(`${dex.toLowerCase()}:${coinParts.join(":")}`);
      return candidates;
    }
  }

  addCandidate(normalized);

  const trimmed = normalized
    .replace(/USDT?$/, "")
    .replace(/USDC?$/, "")
    .replace(/_PERP$/, "");
  if (trimmed && trimmed !== normalized) addCandidate(trimmed);

  return candidates;
}

async function probeImageUrl(url: string): Promise<string | null> {
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        resolve(false);
      }, 4000);
      img.addEventListener(
        "load",
        () => {
          clearTimeout(timer);
          resolve(true);
        },
        { once: true },
      );
      img.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          resolve(false);
        },
        { once: true },
      );
      img.src = url;
    });
    return ok ? url : null;
  } catch {
    return null;
  }
}

async function resolveLogoUrl(symbol: string): Promise<string | null> {
  const candidates = getSymbolLogoCandidates(symbol);
  // Probe sequentially, stopping at the first logo that loads.
  const resolved = await candidates.reduce<Promise<string | null>>(async (previous, url) => {
    const found = await previous;
    if (found !== null) return found;
    return probeImageUrl(url);
  }, Promise.resolve(null));
  return resolved;
}

export function useHyperliquidSymbolLogo(symbol: string) {
  return useQuery({
    queryKey: queryKeys.asset.logo(symbol),
    queryFn: () => resolveLogoUrl(symbol),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
