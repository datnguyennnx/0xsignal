import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

const HYPERLIQUID_COIN_ICON_BASE = "https://app.hyperliquid.xyz/coins";
const logoResultCache = new Map<string, string | null>();
const logoResolvePromiseCache = new Map<string, Promise<string | null>>();
const imageProbeCache = new Map<string, Promise<boolean>>();
const MAX_PARALLEL_IMAGE_PROBES = 6;
let activeImageProbes = 0;
const imageProbeQueue: Array<() => void> = [];
const LOGO_STALE_TIME = 24 * 60 * 60 * 1000;
const LOGO_GC_TIME = 24 * 60 * 60 * 1000;

function normalizeSymbol(rawSymbol: string): string {
  return rawSymbol.trim().toUpperCase();
}

export function getHyperliquidSymbolLogoCandidates(symbol: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return [];

  const clean = normalized.replace(/\s+/g, "");
  const candidates: string[] = [];

  const addCandidate = (value: string) => {
    const url = `${HYPERLIQUID_COIN_ICON_BASE}/${value}.svg`;
    if (!candidates.includes(url)) {
      candidates.push(url);
    }
  };

  if (clean.startsWith("@")) {
    return [];
  }

  if (clean.includes(":")) {
    const [dexRaw, ...coinParts] = clean.split(":");
    const dex = dexRaw.toLowerCase();
    const coin = coinParts.join(":");
    if (dex && coin) {
      addCandidate(`${dex}:${coin}`);
      return candidates;
    }
  }

  if (clean.endsWith("_SPOT")) {
    addCandidate(clean.replace(/_SPOT$/, "_spot"));
    return candidates;
  }

  addCandidate(clean);

  const quoteTrimmed = clean
    .replace(/USDT?$/, "")
    .replace(/USDC?$/, "")
    .replace(/_PERP$/, "");
  if (quoteTrimmed && quoteTrimmed !== clean) {
    addCandidate(quoteTrimmed);
  }

  return candidates;
}

function probeImage(url: string): Promise<boolean> {
  const cachedProbe = imageProbeCache.get(url);
  if (cachedProbe) return cachedProbe;

  const probePromise = new Promise<boolean>((resolve) => {
    const execute = () => {
      activeImageProbes += 1;

      const image = new Image();
      const timeout = window.setTimeout(() => {
        image.onload = null;
        image.onerror = null;
        activeImageProbes -= 1;
        imageProbeQueue.shift()?.();
        resolve(false);
      }, 4000);

      image.onload = () => {
        window.clearTimeout(timeout);
        activeImageProbes -= 1;
        imageProbeQueue.shift()?.();
        resolve(true);
      };

      image.onerror = () => {
        window.clearTimeout(timeout);
        activeImageProbes -= 1;
        imageProbeQueue.shift()?.();
        resolve(false);
      };

      image.src = url;
    };

    if (activeImageProbes < MAX_PARALLEL_IMAGE_PROBES) {
      execute();
      return;
    }

    imageProbeQueue.push(execute);
  });

  imageProbeCache.set(url, probePromise);
  return probePromise;
}

async function resolveHyperliquidSymbolLogo(symbol: string): Promise<string | null> {
  const cacheKey = normalizeSymbol(symbol);
  if (!cacheKey) return null;

  const cachedResult = logoResultCache.get(cacheKey);
  if (cachedResult !== undefined) return cachedResult;

  const cachedPromise = logoResolvePromiseCache.get(cacheKey);
  if (cachedPromise) return cachedPromise;

  const resolvePromise = (async () => {
    const candidates = getHyperliquidSymbolLogoCandidates(symbol);
    for (const candidate of candidates) {
      if (await probeImage(candidate)) {
        logoResultCache.set(cacheKey, candidate);
        return candidate;
      }
    }

    logoResultCache.set(cacheKey, null);
    return null;
  })();

  logoResolvePromiseCache.set(cacheKey, resolvePromise);
  try {
    return await resolvePromise;
  } finally {
    logoResolvePromiseCache.delete(cacheKey);
  }
}

export function useHyperliquidSymbolLogo(symbol: string) {
  return useQuery({
    queryKey: queryKeys.hyperliquid.symbolLogo(symbol),
    queryFn: () => resolveHyperliquidSymbolLogo(symbol),
    enabled: !!symbol,
    staleTime: LOGO_STALE_TIME,
    gcTime: LOGO_GC_TIME,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export async function prefetchHyperliquidSymbolLogos(
  queryClient: QueryClient,
  symbols: string[]
): Promise<void> {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))];
  await Promise.allSettled(
    uniqueSymbols.map((symbol) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.hyperliquid.symbolLogo(symbol),
        queryFn: () => resolveHyperliquidSymbolLogo(symbol),
        staleTime: LOGO_STALE_TIME,
        gcTime: LOGO_GC_TIME,
      })
    )
  );
}
