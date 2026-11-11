import type { WsActiveAssetCtx } from "@0xsignal/sdk-hyperliquid/subscription";

export type AssetCtxSnapshot = {
  readonly markPx: number;
  readonly prevDayPx: number;
  readonly funding: number;
  readonly dayNtlVlm: number;
  readonly openInterest: number;
  readonly oraclePx: number;
};

export function parseAssetCtx(raw: WsActiveAssetCtx["ctx"]): AssetCtxSnapshot | null {
  const markPx = Number(raw.markPx);
  const prevDayPx = Number(raw.prevDayPx);
  if (!Number.isFinite(markPx) || !Number.isFinite(prevDayPx) || prevDayPx === 0) return null;

  const oraclePx = Number(raw.oraclePx);
  return {
    markPx,
    prevDayPx,
    funding: Number(raw.funding),
    dayNtlVlm: Number(raw.dayNtlVlm),
    openInterest: Number(raw.openInterest),
    oraclePx: Number.isFinite(oraclePx) ? oraclePx : markPx,
  };
}
