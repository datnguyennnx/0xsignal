import { Context, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { WhaleLeaderboardRow } from "@0xsignal/shared";
import { WhaleConfig } from "../../config/whale.config";
import { HyperliquidError, toHyperliquidError } from "./errors";

export interface WhaleLeaderboardProvider {
  readonly fetchLeaderboard: () => Effect.Effect<WhaleLeaderboardRow[], HyperliquidError>;
}

export class WhaleLeaderboard extends Context.Service<WhaleLeaderboard, WhaleLeaderboardProvider>()(
  "WhaleLeaderboard",
) {}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// The leaderboard payload is untrusted: parse only the two fields the shared
// row exposes (ethAddress + accountValue) and reject a row missing either.
const mapRow = (value: unknown): WhaleLeaderboardRow | null => {
  const row = asRecord(value);
  if (!row) return null;
  const ethAddress = typeof row.ethAddress === "string" ? row.ethAddress.trim() : "";
  const accountValue = asFiniteNumber(row.accountValue);
  if (ethAddress.length === 0 || accountValue === undefined) return null;
  return { ethAddress, accountValue };
};

const parseLeaderboard = (payload: unknown, cap: number): WhaleLeaderboardRow[] => {
  const rows = asRecord(payload)?.leaderboardRows;
  if (!Array.isArray(rows)) return [];
  const out: WhaleLeaderboardRow[] = [];
  for (const row of rows) {
    if (out.length >= cap) break;
    const mapped = mapRow(row);
    if (mapped) out.push(mapped);
  }
  return out;
};

interface CacheEntry {
  readonly rows: WhaleLeaderboardRow[];
  readonly expiresAt: number;
}

/**
 * Construction allocates the cache Ref only: no fibers, no network. The first
 * `fetchLeaderboard` populates the TTL cache; calls within the window are served
 * from memory.
 */
export const whaleLeaderboardLayer: Layer.Layer<
  WhaleLeaderboard,
  never,
  HttpClient.HttpClient | WhaleConfig
> = Layer.effect(
  WhaleLeaderboard,
  Effect.gen(function* () {
    const config = yield* WhaleConfig;
    const client = yield* HttpClient.HttpClient;
    const ttlMs = Math.max(0, config.leaderboardTtlMs);
    const cap = Math.max(0, config.seededWalletCap);
    const cache = yield* Ref.make<CacheEntry | null>(null);

    const fetchLeaderboard = (): Effect.Effect<WhaleLeaderboardRow[], HyperliquidError> =>
      Effect.gen(function* () {
        const now = Date.now();
        const cached = yield* Ref.get(cache);
        if (cached !== null && cached.expiresAt > now) return cached.rows;

        const request = HttpClientRequest.get(config.leaderboardUrl).pipe(
          HttpClientRequest.acceptJson,
        );

        // Untrusted payload: a decode failure is logged and treated as no rows.
        // A transport failure still surfaces as HyperliquidError.
        const payload = yield* client.execute(request).pipe(
          Effect.flatMap((response) =>
            response.json.pipe(
              Effect.catch((cause) =>
                Effect.logWarning(
                  `[whale-leaderboard] malformed JSON from ${config.leaderboardUrl}`,
                  cause,
                ).pipe(Effect.as(null)),
              ),
            ),
          ),
          Effect.mapError((cause) => toHyperliquidError("leaderboard fetch failed", cause)),
        );

        const rows = parseLeaderboard(payload, cap);
        yield* Ref.set(cache, { rows, expiresAt: Date.now() + ttlMs });
        return rows;
      });

    return WhaleLeaderboard.of({ fetchLeaderboard });
  }),
);
