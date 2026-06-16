import { createContext, useContext, type ReactNode, type MutableRefObject } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";

interface CandleDataContextValue {
  data: ChartDataPoint[];
  dataRef: MutableRefObject<ChartDataPoint[]>;
  isLoading: boolean;
  loadMore?: (count?: number) => Promise<void>;
  hasMore: boolean;
  isFetching: boolean;
}

const CandleDataContext = createContext<CandleDataContextValue | null>(null);

export function CandleDataProvider({
  data,
  dataRef,
  isLoading,
  loadMore,
  hasMore,
  isFetching,
  children,
}: {
  data: ChartDataPoint[];
  dataRef: MutableRefObject<ChartDataPoint[]>;
  isLoading: boolean;
  loadMore?: (count?: number) => Promise<void>;
  hasMore: boolean;
  isFetching: boolean;
  children: ReactNode;
}) {
  return (
    <CandleDataContext value={{ data, dataRef, isLoading, loadMore, hasMore, isFetching }}>
      {children}
    </CandleDataContext>
  );
}

export function useCandleData(): CandleDataContextValue {
  const context = useContext(CandleDataContext);
  if (!context) {
    throw new Error("useCandleData must be used within a CandleDataProvider");
  }
  return context;
}
