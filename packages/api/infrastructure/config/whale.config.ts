import { Config, Layer } from "effect";
import { WhaleConfig, type WhaleConfigService } from "../../application/whales/config.contracts";

export { WhaleConfig };

// 0 disables the notional filter: every trade passes (show-all whale tape).
const DEFAULT_WHALE_NOTIONAL_USD = 0;
const DEFAULT_COIN_UNIVERSE: ReadonlyArray<string> = ["BTC", "ETH", "SOL"];
const DEFAULT_DISCOVERY_NOTIONAL_USD = 250_000;
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_MAX_WALLETS_PER_POLL = 400;
const DEFAULT_WALLET_TTL_MS = 3_600_000;
// Each clearinghouseState call costs REST weight 2, so this budget caps roughly
// restWeightBudgetPerMin / 2 clearinghouseState polls per minute.
const DEFAULT_REST_WEIGHT_BUDGET_PER_MIN = 1200;
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
  maxWalletsPerPoll: Config.Number("WHALE_MAX_WALLETS_PER_POLL").pipe(
    Config.withDefault(DEFAULT_MAX_WALLETS_PER_POLL),
  ),
  walletTtlMs: Config.Number("WHALE_WALLET_TTL_MS").pipe(Config.withDefault(DEFAULT_WALLET_TTL_MS)),
  restWeightBudgetPerMin: Config.Number("WHALE_REST_WEIGHT_BUDGET_PER_MIN").pipe(
    Config.withDefault(DEFAULT_REST_WEIGHT_BUDGET_PER_MIN),
  ),
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
