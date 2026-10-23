import { Context } from "effect";

export interface WhaleConfigService {
  readonly whaleNotionalUsd: number;
  readonly coinUniverse: ReadonlyArray<string>;
  readonly discoveryNotionalUsd: number;
  readonly pollIntervalMs: number;
  readonly maxWalletsPerPoll: number;
  readonly walletTtlMs: number;
  readonly restWeightBudgetPerMin: number;
  readonly leaderboardUrl: string;
  readonly leaderboardTtlMs: number;
  readonly seededWalletCap: number;
  readonly walletRetentionMs: number;
  readonly positionRetentionMs: number;
}

export class WhaleConfig extends Context.Service<WhaleConfig, WhaleConfigService>()(
  "WhaleConfig",
) {}
