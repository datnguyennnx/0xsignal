export interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  pxDecimals: number;
  maxLeverage: number;
  isDelisted?: boolean;
  marginTableId: number;
}

export interface HyperliquidAssetCtx {
  coin: string;
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  markPx: string;
}

export interface HyperliquidMeta {
  universe: HyperliquidAsset[];
}

export interface HyperliquidMetaAndAssetCtxs {
  meta: HyperliquidMeta;
  assetCtxs: HyperliquidAssetCtx[];
}

export type HyperliquidMetaAndAssetCtxsResponse = [HyperliquidMeta, HyperliquidAssetCtx[]];

export type PerpCategoriesResponse = [string, string][];

export type AllPerpMetasResponse = [HyperliquidMeta, HyperliquidAssetCtx[]][];

const INFO_URL = "https://api.hyperliquid.xyz/info";

async function fetchJson<T>(
  url: string,
  body: { type: string; dex?: string | { name: string } }
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} - ${text}`);
  }

  return response.json();
}

export const hyperliquidApi = {
  getMeta: () => fetchJson<HyperliquidMeta>(INFO_URL, { type: "meta" }),

  getMetaAndAssetCtxs: (dex?: string | { name: string }) =>
    fetchJson<HyperliquidMetaAndAssetCtxsResponse>(INFO_URL, { type: "metaAndAssetCtxs", dex }),

  getPerpCategories: () => fetchJson<PerpCategoriesResponse>(INFO_URL, { type: "perpCategories" }),

  getAllMids: () => fetchJson<Record<string, string>>(INFO_URL, { type: "allMids" }),

  getAllPerpMetas: () => fetchJson<AllPerpMetasResponse>(INFO_URL, { type: "allPerpMetas" }),

  getPerpDexs: () => fetchJson<(string | null)[]>(INFO_URL, { type: "perpDexs" }),
};
