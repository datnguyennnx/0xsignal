import { useState, useCallback, useEffect, useRef } from "react";
import {
  tpPriceFromPercent,
  slPriceFromPercent,
  gainPercentFromPrice,
  lossPercentFromPrice,
  formatPriceFixed,
  formatPctFixed,
} from "../utils/trade-math";

export interface UseTakeProfitStopLossOptions {
  entryPrice: number;
  effectiveLeverage: number;
  isLong: boolean;
}

export interface UseTakeProfitStopLossReturn {
  tpSlEnabled: boolean;
  setTpSlEnabled: (enabled: boolean) => void;
  tpPrice: string;
  tpPercent: string;
  slPrice: string;
  slPercent: string;
  handleTpPercentChange: (raw: string) => void;
  handleTpPriceChange: (raw: string) => void;
  handleSlPercentChange: (raw: string) => void;
  handleSlPriceChange: (raw: string) => void;
}

export function useTakeProfitStopLoss({
  entryPrice,
  effectiveLeverage,
  isLong,
}: UseTakeProfitStopLossOptions): UseTakeProfitStopLossReturn {
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [tpPercent, setTpPercent] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [slPercent, setSlPercent] = useState("");

  // Persist user-entered percentages across env re-calculations
  const tpPercentRef = useRef("");
  const slPercentRef = useRef("");

  const handleTpPercentChange = useCallback(
    (raw: string) => {
      setTpPercent(raw);
      tpPercentRef.current = raw;
      const pct = Number(raw);
      if (entryPrice > 0 && effectiveLeverage > 0 && pct > 0) {
        const price = tpPriceFromPercent(entryPrice, pct, effectiveLeverage, isLong);
        setTpPrice(formatPriceFixed(price));
      } else {
        setTpPrice("");
      }
    },
    [entryPrice, effectiveLeverage, isLong],
  );

  const handleTpPriceChange = useCallback(
    (raw: string) => {
      setTpPrice(raw);
      const px = Number(raw);
      if (entryPrice > 0 && effectiveLeverage > 0 && px > 0) {
        const pct = gainPercentFromPrice(entryPrice, px, effectiveLeverage, isLong);
        const formatted = formatPctFixed(pct);
        setTpPercent(formatted);
        tpPercentRef.current = formatted;
      } else {
        setTpPercent("");
        tpPercentRef.current = "";
      }
    },
    [entryPrice, effectiveLeverage, isLong],
  );

  const handleSlPercentChange = useCallback(
    (raw: string) => {
      setSlPercent(raw);
      slPercentRef.current = raw;
      const pct = Number(raw);
      if (entryPrice > 0 && effectiveLeverage > 0 && pct > 0) {
        const price = slPriceFromPercent(entryPrice, pct, effectiveLeverage, isLong);
        setSlPrice(formatPriceFixed(price));
      } else {
        setSlPrice("");
      }
    },
    [entryPrice, effectiveLeverage, isLong],
  );

  const handleSlPriceChange = useCallback(
    (raw: string) => {
      setSlPrice(raw);
      const px = Number(raw);
      if (entryPrice > 0 && effectiveLeverage > 0 && px > 0) {
        const pct = lossPercentFromPrice(entryPrice, px, effectiveLeverage, isLong);
        const formatted = formatPctFixed(pct);
        setSlPercent(formatted);
        slPercentRef.current = formatted;
      } else {
        setSlPercent("");
        slPercentRef.current = "";
      }
    },
    [entryPrice, effectiveLeverage, isLong],
  );

  useEffect(() => {
    if (entryPrice > 0 && effectiveLeverage > 0) {
      const tpPct = Number(tpPercentRef.current);
      if (tpPercentRef.current && tpPct > 0) {
        setTpPrice(
          formatPriceFixed(tpPriceFromPercent(entryPrice, tpPct, effectiveLeverage, isLong)),
        );
      }
      const slPct = Number(slPercentRef.current);
      if (slPercentRef.current && slPct > 0) {
        setSlPrice(
          formatPriceFixed(slPriceFromPercent(entryPrice, slPct, effectiveLeverage, isLong)),
        );
      }
    }
  }, [isLong, effectiveLeverage, entryPrice]);

  return {
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
  };
}
