import { Effect } from "effect";
import { AccountNotFound } from "../../../domain/errors";

type MasterWalletRow = { readonly wallet_address: string };

export function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "23505"
  );
}

export function resolveMasterWallet(
  pg: NonNullable<import("pg").Pool>,
  accountId: string,
): Effect.Effect<string, AccountNotFound> {
  return Effect.tryPromise(async () => {
    const result = await pg.query<MasterWalletRow>(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, node_type, wallet_address
         FROM exchange_accounts WHERE id = $1
         UNION ALL
         SELECT ea.id, ea.parent_id, ea.node_type, ea.wallet_address
         FROM exchange_accounts ea
         INNER JOIN chain c ON c.parent_id = ea.id
       )
       SELECT wallet_address FROM chain WHERE node_type = 'wallet' LIMIT 1`,
      [accountId],
    );
    if (result.rows.length === 0) {
      throw new AccountNotFound({
        accountId: `master-wallet:${accountId}`,
      });
    }
    return result.rows[0].wallet_address;
  }).pipe(
    Effect.catch((error: unknown) =>
      error instanceof AccountNotFound ? Effect.fail(error) : Effect.die(error),
    ),
  );
}
