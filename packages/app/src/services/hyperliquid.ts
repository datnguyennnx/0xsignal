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

export type PerpCategory = [string, string];

export type PerpCategoriesResponse = Record<string, PerpCategory>;

const INFO_URL = "https://api.hyperliquid.xyz/info";

async function fetchJson<T>(url: string, body: { type: string }): Promise<T> {
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

  getMetaAndAssetCtxs: () =>
    fetchJson<HyperliquidMetaAndAssetCtxsResponse>(INFO_URL, { type: "metaAndAssetCtxs" }),

  getPerpCategories: () => fetchJson<PerpCategoriesResponse>(INFO_URL, { type: "perpCategories" }),

  getAllMids: () => fetchJson<Record<string, string>>(INFO_URL, { type: "allMids" }),

  getAllPerpMetas: () =>
    fetchJson<{ universe: { name: string; maxLeverage: number }[] }>(INFO_URL, {
      type: "allPerpMetas",
    }),
};
