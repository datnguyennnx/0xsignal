import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

const HYPERLIQUID_COIN_ICON_BASE = "https://app.hyperliquid.xyz/coins";
const LOGO_RESULT_CACHE = new Map<string, string | null>();
const LOGO_RESOLVE_PROMISE_CACHE = new Map<string, Promise<string | null>>();
const IMAGE_PROBE_CACHE = new Map<string, Promise<boolean>>();
const MAX_PARALLEL_IMAGE_PROBES = 6;
let ACTIVE_IMAGE_PROBES = 0;
const IMAGE_PROBE_QUEUE: Array<() => void> = [];
const LOGO_STALE_TIME = 24 * 60 * 60 * 1000;
const LOGO_GC_TIME = 24 * 60 * 60 * 1000;

function normalizeSymbol(rawSymbol: string): string {
  return rawSymbol.trim().toUpperCase();
}

function getHyperliquidSymbolLogoCandidates(symbol: string): string[] {
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
  const cachedProbe = IMAGE_PROBE_CACHE.get(url);
  if (cachedProbe) return cachedProbe;

  const probePromise = new Promise<boolean>((resolve) => {
    const execute = () => {
      ACTIVE_IMAGE_PROBES += 1;

      const image = new Image();
      const timeout = window.setTimeout(() => {
        image.onload = null;
        image.onerror = null;
        ACTIVE_IMAGE_PROBES -= 1;
        IMAGE_PROBE_QUEUE.shift()?.();
        resolve(false);
      }, 4000);

      image.onload = () => {
        window.clearTimeout(timeout);
        ACTIVE_IMAGE_PROBES -= 1;
        IMAGE_PROBE_QUEUE.shift()?.();
        resolve(true);
      };

      image.onerror = () => {
        window.clearTimeout(timeout);
        ACTIVE_IMAGE_PROBES -= 1;
        IMAGE_PROBE_QUEUE.shift()?.();
        resolve(false);
      };

      image.src = url;
    };

    if (ACTIVE_IMAGE_PROBES < MAX_PARALLEL_IMAGE_PROBES) {
      execute();
      return;
    }

    IMAGE_PROBE_QUEUE.push(execute);
  });

  IMAGE_PROBE_CACHE.set(url, probePromise);
  return probePromise;
}

async function resolveHyperliquidSymbolLogo(symbol: string): Promise<string | null> {
  const cacheKey = normalizeSymbol(symbol);
  if (!cacheKey) return null;

  const cachedResult = LOGO_RESULT_CACHE.get(cacheKey);
  if (cachedResult !== undefined) return cachedResult;

  const cachedPromise = LOGO_RESOLVE_PROMISE_CACHE.get(cacheKey);
  if (cachedPromise) return cachedPromise;

  const resolvePromise = (async () => {
    const candidates = getHyperliquidSymbolLogoCandidates(symbol);
    for (const candidate of candidates) {
      if (await probeImage(candidate)) {
        LOGO_RESULT_CACHE.set(cacheKey, candidate);
        return candidate;
      }
    }

    LOGO_RESULT_CACHE.set(cacheKey, null);
    return null;
  })();

  LOGO_RESOLVE_PROMISE_CACHE.set(cacheKey, resolvePromise);
  try {
    return await resolvePromise;
  } finally {
    LOGO_RESOLVE_PROMISE_CACHE.delete(cacheKey);
  }
}

export function useHyperliquidSymbolLogo(symbol: string) {
  return useQuery({
    queryKey: queryKeys.asset.logo(symbol),
    queryFn: () => resolveHyperliquidSymbolLogo(symbol),
    enabled: !!symbol,
    staleTime: LOGO_STALE_TIME,
    gcTime: LOGO_GC_TIME,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
