import type { ClearinghouseState, SpotClearinghouseState } from "@0xsignal/shared";

type AssetPosition = ClearinghouseState["assetPositions"][number];

type OrderFormSide = "buy" | "sell";
type OrderFormType = "market" | "limit";

export interface ChainLeverage {
  currentAssetPosition: AssetPosition | undefined;
  currentLeverageFromChain: number;
  currentMarginTypeFromChain: "cross" | "isolated";
}

export function deriveChainLeverage(
  assetPositions: readonly AssetPosition[] | undefined,
  normalizedSymbol: string,
): ChainLeverage {
  const currentAssetPosition = assetPositions?.find((ap) => ap.position.coin === normalizedSymbol);
  const leverage = currentAssetPosition?.position?.leverage;
  return {
    currentAssetPosition,
    currentLeverageFromChain: leverage?.value ?? 20,
    currentMarginTypeFromChain: leverage?.type === "isolated" ? "isolated" : "cross",
  };
}

export interface AccountBalances {
  accountValue: number;
  perpsUsdc: number;
  spotUsdc: number;
}

export function deriveAccountBalances(
  chData: ClearinghouseState | undefined,
  spotData: SpotClearinghouseState | undefined,
): AccountBalances {
  const accountValue = Number(chData?.marginSummary?.accountValue ?? 0);
  const perpsUsdc = Number(chData?.withdrawable ?? 0);
  const spotUsdc = Number(spotData?.balances?.find((b) => b.coin === "USDC")?.total ?? 0);
  return { accountValue, perpsUsdc, spotUsdc };
}

export interface SizeAssetOption {
  value: string;
  label: string;
  balance: number;
}

export function buildSizeAssetOptions(
  accountValue: number,
  perpsUsdc: number,
  spotUsdc: number,
  spotData: SpotClearinghouseState | undefined,
): SizeAssetOption[] {
  const map = new Map<string, number>();
  if (accountValue > 0) map.set("USDC", perpsUsdc);
  for (const b of spotData?.balances ?? []) {
    const bal = Number(b.total);
    if (bal > 0) map.set(b.coin, bal);
  }
  if (!map.has("USDC") && spotUsdc > 0) map.set("USDC", spotUsdc);
  return Array.from(map.entries()).map(([coin, bal]) => ({
    value: coin,
    label: coin,
    balance: bal,
  }));
}

export interface SizeAssetSelection {
  safeSizeAsset: string;
  effectiveBalance: number;
}

export function deriveSizeAssetSelection(
  options: readonly SizeAssetOption[],
  sizeAsset: string,
): SizeAssetSelection {
  const safeSizeAsset = options.some((o) => o.value === sizeAsset)
    ? sizeAsset
    : (options[0]?.value ?? "USDC");
  const effectiveBalance = options.find((o) => o.value === safeSizeAsset)?.balance ?? 0;
  return { safeSizeAsset, effectiveBalance };
}

export interface OrderAmountsInput {
  markPrice: number;
  price: string;
  orderType: OrderFormType;
  size: string;
  side: OrderFormSide;
  effectiveLeverage: number;
}

export interface OrderAmounts {
  usablePrice: number;
  orderValue: number;
  marginRequired: number;
  isLong: boolean;
}

export function deriveOrderAmounts({
  markPrice,
  price,
  orderType,
  size,
  side,
  effectiveLeverage,
}: OrderAmountsInput): OrderAmounts {
  const currentPrice = markPrice || Number(price) || 0;
  const usablePrice = currentPrice > 0 ? currentPrice : orderType === "limit" ? Number(price) : 0;
  const orderValue = Number(size) || 0;
  const marginRequired = effectiveLeverage > 0 ? orderValue / effectiveLeverage : 0;
  return { usablePrice, orderValue, marginRequired, isLong: side === "buy" };
}

export interface EntryPriceInput {
  orderType: OrderFormType;
  price: string;
  markPrice: number;
}

export function deriveEntryPrice({ orderType, price, markPrice }: EntryPriceInput): number {
  return orderType === "limit" ? Number(price) || 0 : markPrice || 0;
}

export interface CanPlaceInput {
  signingDisabled: boolean;
  size: string;
  usablePrice: number;
  orderType: OrderFormType;
  price: string;
}

export function canPlace({
  signingDisabled,
  size,
  usablePrice,
  orderType,
  price,
}: CanPlaceInput): boolean {
  return (
    !signingDisabled &&
    Number(size) > 0 &&
    usablePrice > 0 &&
    !(orderType === "limit" && (!price || Number(price) <= 0))
  );
}

export function frameClass(signingDisabled: boolean): string {
  return signingDisabled ? "contents pointer-events-none opacity-60" : "contents";
}
