export interface DataMeta {
  readonly updatedAt: Date;
  readonly source: string;
  readonly isEstimate?: boolean;
  readonly ttlSeconds?: number;
}

export interface WithMeta<T> {
  readonly data: T;
  readonly meta: DataMeta;
}

export const createMeta = (source: string, isEstimate = false, ttlSeconds?: number): DataMeta => ({
  updatedAt: new Date(),
  source,
  isEstimate,
  ttlSeconds,
});

export const DATA_SOURCES = {
  COINGECKO: "CoinGecko",
  BINANCE: "Binance",
  DEFILLAMA: "DeFiLlama",
  COMPUTED: "Computed",
} as const;

export type DataSourceName = (typeof DATA_SOURCES)[keyof typeof DATA_SOURCES];
