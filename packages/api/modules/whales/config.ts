import { Config, ConfigProvider, Context, Effect, Layer } from "effect";

export interface WhaleConfigService {
  readonly whaleNotionalUsd: number;
  readonly coinUniverse: ReadonlyArray<string>;
  readonly discoveryNotionalUsd: number;
  readonly pollIntervalMs: number;
  readonly maxWalletsPerPoll: number;
  readonly walletTtlMs: number;
  readonly leaderboardUrl: string;
  readonly leaderboardTtlMs: number;
  readonly seededWalletCap: number;
  readonly walletRetentionMs: number;
  readonly positionRetentionMs: number;
}

export class WhaleConfig extends Context.Service<WhaleConfig, WhaleConfigService>()(
  "WhaleConfig",
) {}

// 0 disables the notional filter: every trade passes (show-all whale tape).
const DEFAULT_WHALE_NOTIONAL_USD = 0;
const DEFAULT_COIN_UNIVERSE: ReadonlyArray<string> = ["BTC", "ETH", "SOL"];
const DEFAULT_DISCOVERY_NOTIONAL_USD = 250_000;
const DEFAULT_POLL_INTERVAL_MS = 60_000;
// Hard ceiling: the shared 1200 weight/min upstream budget, not a preference.
// 50 wallets x weight 2 + allMids weight 2 = 102 weight per tick.
const MAX_WALLETS_PER_POLL_CEILING = 50;
const DEFAULT_MAX_WALLETS_PER_POLL = MAX_WALLETS_PER_POLL_CEILING;
const DEFAULT_WALLET_TTL_MS = 3_600_000;
const DEFAULT_LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";
const DEFAULT_LEADERBOARD_TTL_MS = 300_000;
const DEFAULT_SEEDED_WALLET_CAP = 1000;
const DEFAULT_WALLET_RETENTION_MS = 86_400_000;
const DEFAULT_POSITION_RETENTION_MS = 86_400_000;

const coinUniverseConfig: Config.Config<ReadonlyArray<string>> = Config.String(
  "WHALE_COIN_UNIVERSE",
).pipe(
  Config.map((csv) =>
    csv
      .split(",")
      .map((coin) => coin.trim())
      .filter((coin) => coin.length > 0),
  ),
  Config.withDefault(DEFAULT_COIN_UNIVERSE),
);

const maxWalletsPerPollConfig: Config.Config<number> = Config.Number(
  "WHALE_MAX_WALLETS_PER_POLL",
).pipe(
  Config.withDefault(DEFAULT_MAX_WALLETS_PER_POLL),
  Config.mapEffect((value) =>
    Number.isInteger(value) && value >= 0 && value <= MAX_WALLETS_PER_POLL_CEILING
      ? Effect.succeed(value)
      : Effect.fail(
          new Config.ConfigError(
            new ConfigProvider.SourceError({
              message: `WHALE_MAX_WALLETS_PER_POLL=${value} must be an integer in [0, ${MAX_WALLETS_PER_POLL_CEILING}]: the ceiling is the shared 1200 weight/min upstream budget`,
            }),
          ),
        ),
  ),
);

const whaleConfig: Config.Config<WhaleConfigService> = Config.all({
  whaleNotionalUsd: Config.Number("WHALE_NOTIONAL_USD").pipe(
    Config.withDefault(DEFAULT_WHALE_NOTIONAL_USD),
  ),
  coinUniverse: coinUniverseConfig,
  discoveryNotionalUsd: Config.Number("WHALE_DISCOVERY_NOTIONAL_USD").pipe(
    Config.withDefault(DEFAULT_DISCOVERY_NOTIONAL_USD),
  ),
  pollIntervalMs: Config.Number("WHALE_POLL_INTERVAL_MS").pipe(
    Config.withDefault(DEFAULT_POLL_INTERVAL_MS),
  ),
  maxWalletsPerPoll: maxWalletsPerPollConfig,
  walletTtlMs: Config.Number("WHALE_WALLET_TTL_MS").pipe(Config.withDefault(DEFAULT_WALLET_TTL_MS)),
  leaderboardUrl: Config.String("WHALE_LEADERBOARD_URL").pipe(
    Config.withDefault(DEFAULT_LEADERBOARD_URL),
  ),
  leaderboardTtlMs: Config.Number("WHALE_LEADERBOARD_TTL_MS").pipe(
    Config.withDefault(DEFAULT_LEADERBOARD_TTL_MS),
  ),
  seededWalletCap: Config.Number("WHALE_SEEDED_WALLET_CAP").pipe(
    Config.withDefault(DEFAULT_SEEDED_WALLET_CAP),
  ),
  walletRetentionMs: Config.Number("WHALE_WALLET_RETENTION_MS").pipe(
    Config.withDefault(DEFAULT_WALLET_RETENTION_MS),
  ),
  positionRetentionMs: Config.Number("WHALE_POSITION_RETENTION_MS").pipe(
    Config.withDefault(DEFAULT_POSITION_RETENTION_MS),
  ),
});

export const WhaleConfigLayer: Layer.Layer<WhaleConfig, Config.ConfigError> = Layer.effect(
  WhaleConfig,
  whaleConfig,
);
