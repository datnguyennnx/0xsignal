import { useMemo, useState } from "react";
import { useClearinghouseState, useSpotClearinghouseState } from "../hooks/use-user-data";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useTpSlOrchestration } from "../hooks/use-tp-sl-orchestration";
import { useLeverageMarginState } from "../hooks/use-leverage-margin-state";
import { useOrderFormSubmit } from "../hooks/use-order-form-submit";
import {
  buildSizeAssetOptions,
  deriveAccountBalances,
  deriveChainLeverage,
  deriveEntryPrice,
  deriveOrderAmounts,
  deriveSizeAssetSelection,
  type SizeAssetOption,
} from "./order-form-derivations";

interface UseOrderFormStateOptions {
  symbol: string;
  markPrice: number;
}

export function useOrderFormState({ symbol, markPrice }: UseOrderFormStateOptions) {
  const { data: chData } = useClearinghouseState();
  const { data: spotData } = useSpotClearinghouseState();
  const { getPrecision } = useHyperliquidMeta();
  const { szDecimals, maxLeverage } = getPrecision(symbol);

  // Normalize: URL param may be lowercase ("btc") but API returns uppercase ("BTC")
  const normalizedSymbol = symbol.toUpperCase();
  const { currentAssetPosition, currentLeverageFromChain, currentMarginTypeFromChain } =
    deriveChainLeverage(chData?.assetPositions, normalizedSymbol);

  const {
    adjustLeverageOpen,
    setAdjustLeverageOpen,
    marginModeOpen,
    setMarginModeOpen,
    setOverrideLeverage,
    setOverrideMarginMode,
    effectiveLeverage,
    effectiveMarginMode,
  } = useLeverageMarginState({
    currentLeverageFromChain,
    currentMarginTypeFromChain,
  });

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [sliderPercent, setSliderPercent] = useState(0);
  const [price, setPrice] = useState("");
  const [priceInvalid, setPriceInvalid] = useState(false);

  const [sizeAsset, setSizeAsset] = useState("USDC");

  const { usablePrice, orderValue, marginRequired, isLong } = deriveOrderAmounts({
    markPrice,
    price,
    orderType,
    size,
    side,
    effectiveLeverage,
  });
  const entryPrice = deriveEntryPrice({ orderType, price, markPrice });

  const {
    tpSlEnabled,
    setTpSlEnabled,
    tpPrice,
    tpPercent,
    slPrice,
    slPercent,
    handleTpPercentChange,
    handleTpPriceChange,
    handleSlPercentChange,
    handleSlPriceChange,
    reduceOnly,
    setReduceOnly,
    showTpSl,
  } = useTpSlOrchestration({ entryPrice, effectiveLeverage, isLong });

  const { accountValue, perpsUsdc, spotUsdc } = deriveAccountBalances(chData, spotData);

  const sizeAssetOptions: SizeAssetOption[] = useMemo(
    () => buildSizeAssetOptions(accountValue, perpsUsdc, spotUsdc, spotData),
    [accountValue, perpsUsdc, spotUsdc, spotData],
  );

  const { safeSizeAsset, effectiveBalance } = deriveSizeAssetSelection(sizeAssetOptions, sizeAsset);

  const { handlePlaceOrder, isPending, signingDisabled } = useOrderFormSubmit({
    symbol,
    side,
    orderType,
    price,
    size,
    usablePrice,
    szDecimals,
    reduceOnly,
    showTpSl,
    tpPrice,
    slPrice,
    onPriceInvalid: () => {
      setPriceInvalid(true);
    },
  });

  return {
    adjustLeverageOpen,
    setAdjustLeverageOpen,
    marginModeOpen,
    setMarginModeOpen,
    setOverrideLeverage,
    setOverrideMarginMode,
    effectiveLeverage,
    effectiveMarginMode,
    szDecimals,
    maxLeverage,
    normalizedSymbol,
    currentAssetPosition,
    currentLeverageFromChain,
    currentMarginTypeFromChain,
    side,
    setSide,
    orderType,
    setOrderType,
    size,
    setSize,
    price,
    setPrice,
    priceInvalid,
    setPriceInvalid,
    sliderPercent,
    setSliderPercent,
    sizeAsset,
    setSizeAsset,
    usablePrice,
    orderValue,
    marginRequired,
    tpSlEnabled,
    setTpSlEnabled,
    tpPrice,
    tpPercent,
    slPrice,
    slPercent,
    handleTpPercentChange,
    handleTpPriceChange,
    handleSlPercentChange,
    handleSlPriceChange,
    reduceOnly,
    setReduceOnly,
    showTpSl,
    sizeAssetOptions,
    safeSizeAsset,
    effectiveBalance,
    handlePlaceOrder,
    isPending,
    signingDisabled,
  };
}
