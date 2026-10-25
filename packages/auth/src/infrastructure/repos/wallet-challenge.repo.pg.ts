import { Effect } from "effect";
import type { WalletChallenge } from "../../domain/wallet-challenge";
import {
  WalletChallengeAddressMismatch,
  WalletChallengeExpired,
  WalletChallengeNotFound,
  WalletChallengeUsed,
} from "../../domain/errors";
import type {
  IssueWalletChallengeParams,
  WalletChallengeLookupError,
  WalletChallengeLookupParams,
  WalletChallengeRepoPort,
} from "./wallet-challenge.repo";

type WalletChallengeRow = {
  readonly id: string;
  readonly user_id: string;
  readonly wallet_address: string;
  readonly nonce: string;
  readonly message: string;
  readonly expires_at: Date | string;
  readonly consumed_at: Date | string | null;
};

const ts = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value);

const mapRow = (row: WalletChallengeRow): WalletChallenge => ({
  id: row.id,
  userId: row.user_id,
  walletAddress: row.wallet_address,
  nonce: row.nonce,
  message: row.message,
  expiresAt: ts(row.expires_at),
  ...(row.consumed_at !== null && { consumedAt: ts(row.consumed_at) }),
});

const classify = (
  row: WalletChallengeRow | undefined,
  params: WalletChallengeLookupParams,
): Effect.Effect<WalletChallenge, WalletChallengeLookupError> => {
  if (row === undefined || row.user_id !== params.userId) {
    return Effect.fail(new WalletChallengeNotFound({ nonce: params.nonce }));
  }
  if (row.wallet_address.toLowerCase() !== params.walletAddress.toLowerCase()) {
    return Effect.fail(new WalletChallengeAddressMismatch({ nonce: params.nonce }));
  }
  if (row.consumed_at !== null) {
    return Effect.fail(new WalletChallengeUsed({ nonce: params.nonce }));
  }
  if (Date.parse(ts(row.expires_at)) <= Date.now()) {
    return Effect.fail(new WalletChallengeExpired({ nonce: params.nonce }));
  }
  return Effect.succeed(mapRow(row));
};

export function pgWalletChallengeRepo(pg: NonNullable<import("pg").Pool>): WalletChallengeRepoPort {
  const findByNonce = (nonce: string) =>
    pg.query<WalletChallengeRow>("SELECT * FROM wallet_challenges WHERE nonce = $1", [nonce]);

  return {
    issue: (params: IssueWalletChallengeParams) =>
      Effect.tryPromise(async () => {
        await pg.query(
          "DELETE FROM wallet_challenges WHERE user_id = $1 AND lower(wallet_address) = lower($2)",
          [params.userId, params.walletAddress],
        );
        const result = await pg.query<WalletChallengeRow>(
          `INSERT INTO wallet_challenges (user_id, wallet_address, nonce, message, expires_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [params.userId, params.walletAddress, params.nonce, params.message, params.expiresAt],
        );
        return mapRow(result.rows[0]);
      }).pipe(Effect.orDie),

    findActive: (params) =>
      Effect.tryPromise(() => findByNonce(params.nonce)).pipe(
        Effect.orDie,
        Effect.flatMap((result) => classify(result.rows[0], params)),
      ),

    consume: (params) =>
      Effect.tryPromise(() =>
        pg.query<WalletChallengeRow>(
          `UPDATE wallet_challenges
              SET consumed_at = NOW()
            WHERE nonce = $1
              AND user_id = $2
              AND lower(wallet_address) = lower($3)
              AND consumed_at IS NULL
              AND expires_at > NOW()
          RETURNING *`,
          [params.nonce, params.userId, params.walletAddress],
        ),
      ).pipe(
        Effect.orDie,
        Effect.flatMap((result) => {
          if (result.rows.length > 0) return Effect.void;
          // Lost the atomic race, or the row was already bad: classify for the caller.
          return Effect.tryPromise(() => findByNonce(params.nonce)).pipe(
            Effect.orDie,
            Effect.flatMap((fallback) => classify(fallback.rows[0], params).pipe(Effect.asVoid)),
          );
        }),
      ),
  };
}
