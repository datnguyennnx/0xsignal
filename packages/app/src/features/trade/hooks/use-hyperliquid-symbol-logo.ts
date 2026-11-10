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

const LOGO_PROBE_TIMEOUT_MS = 1500;

async function probeImageUrl(url: string): Promise<string | null> {
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      let timer: ReturnType<typeof setTimeout> | null = null;

      const onLoad = (): void => {
        if (timer !== null) clearTimeout(timer);
        img.removeEventListener("error", onError);
        resolve(true);
      };
      const onError = (): void => {
        if (timer !== null) clearTimeout(timer);
        img.removeEventListener("load", onLoad);
        resolve(false);
      };

      timer = setTimeout(() => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
        // Detach the source so a late response cannot resolve after the timeout.
        img.src = "";
        resolve(false);
      }, LOGO_PROBE_TIMEOUT_MS);

      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
      img.src = url;
    });
    return ok ? url : null;
  } catch {
    return null;
  }
}

async function resolveLogoUrl(symbol: string): Promise<string | null> {
  const candidates = getSymbolLogoCandidates(symbol);
  if (candidates.length === 0) return null;
  // Probe in parallel and take the first hit; a sequential walk paid one timeout per miss.
  try {
    return await Promise.any(
      candidates.map(async (url) => {
        const found = await probeImageUrl(url);
        if (found === null) throw new Error("logo missing");
        return found;
      }),
    );
  } catch {
    return null;
  }
}

export function hyperliquidSymbolLogoQueryOptions(symbol: string) {
  return {
    queryKey: queryKeys.asset.logo(symbol),
    queryFn: () => resolveLogoUrl(symbol),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    // The logo probe answers for a day; a reconnect adds nothing.
    refetchOnReconnect: false,
    retry: false,
  };
}

export function useHyperliquidSymbolLogo(symbol: string) {
  return useQuery(hyperliquidSymbolLogoQueryOptions(symbol));
}
