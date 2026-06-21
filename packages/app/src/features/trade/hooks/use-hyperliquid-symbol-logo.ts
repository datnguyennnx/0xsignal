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
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }, 4000);
      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      img.src = url;
    });
    return ok ? url : null;
  } catch {
    return null;
  }
}

async function resolveLogoUrl(symbol: string): Promise<string | null> {
  const candidates = getSymbolLogoCandidates(symbol);
  for (const url of candidates) {
    const result = await probeImageUrl(url);
    if (result) return result;
  }
  return null;
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
