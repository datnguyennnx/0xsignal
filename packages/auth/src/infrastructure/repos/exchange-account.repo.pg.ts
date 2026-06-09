import { Effect, Match } from "effect";
import type { ExchangeAccount } from "../../domain/exchange-credential";
import { AccountNotFound, DuplicateLabel } from "../../domain/errors";
import { isPgUniqueViolation, resolveMasterWallet } from "./shared/pg-utils";
import type { ExchangeAccountRepoPort } from "./exchange-account.repo";

export function pgExchangeAccountRepo(pg: NonNullable<import("pg").Pool>): ExchangeAccountRepoPort {
  return {
    create: (params) =>
      Effect.tryPromise(async () => {
        const exchangeResult = await pg.query("SELECT id FROM exchanges WHERE slug = $1", [
          params.exchangeSlug,
        ]);
        if (exchangeResult.rows.length === 0) {
          throw new AccountNotFound({
            accountId: `exchange:${params.exchangeSlug}`,
          });
        }
        const exchangeId = exchangeResult.rows[0].id;

        if (params.parentId) {
          const parentCheck = await pg.query("SELECT id FROM exchange_accounts WHERE id = $1", [
            params.parentId,
          ]);
          if (parentCheck.rows.length === 0) {
            throw new AccountNotFound({ accountId: params.parentId });
          }
        }

        const countResult = await pg.query(
          "SELECT COUNT(*)::int AS cnt FROM exchange_accounts WHERE user_id = $1 AND exchange_id = $2",
          [params.userId, exchangeId]
        );
        const isFirst = countResult.rows[0].cnt === 0;

        const insertResult = await pg.query(
          `INSERT INTO exchange_accounts
           (user_id, exchange_id, node_type, parent_id, wallet_address, chain, label, color, sort_order, is_primary, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
           RETURNING *`,
          [
            params.userId,
            exchangeId,
            params.nodeType,
            params.parentId ?? null,
            params.walletAddress,
            params.chain ?? null,
            params.label ?? "",
            params.color ?? null,
            params.sortOrder ?? 0,
            isFirst,
            JSON.stringify(params.metadata ?? {}),
          ]
        );

        return mapRow(insertResult.rows[0]);
      }).pipe(
        Effect.catch((error: unknown) => {
          if (isPgUniqueViolation(error)) {
            return Effect.fail(new DuplicateLabel({ label: params.label ?? "" }));
          }
          return Match.value(error).pipe(
            Match.when({ _tag: "AccountNotFound" }, (e) => Effect.fail(e as AccountNotFound)),
            Match.when({ _tag: "DuplicateLabel" }, (e) => Effect.fail(e as DuplicateLabel)),
            Match.orElse(() => Effect.die(error))
          );
        })
      ),

    findById: (id, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          "SELECT * FROM exchange_accounts WHERE id = $1 AND user_id = $2",
          [id, userId]
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({ accountId: id });
        }
        return mapRow(result.rows[0]);
      }).pipe(
        Effect.catch((error: unknown) => {
          return Match.value(error).pipe(
            Match.when({ _tag: "AccountNotFound" }, (e) => Effect.fail(e as AccountNotFound)),
            Match.orElse(() => Effect.die(error))
          );
        })
      ),

    findByUserId: (userId, exchangeSlug) =>
      Effect.tryPromise(async () => {
        let query: string;
        let params: unknown[];

        if (exchangeSlug) {
          query = `
            SELECT ea.* FROM exchange_accounts ea
            JOIN exchanges e ON e.id = ea.exchange_id
            WHERE ea.user_id = $1 AND e.slug = $2
            ORDER BY ea.created_at ASC
          `;
          params = [userId, exchangeSlug];
        } else {
          query = "SELECT * FROM exchange_accounts WHERE user_id = $1 ORDER BY created_at ASC";
          params = [userId];
        }

        const result = await pg.query(query, params);
        return result.rows.map(mapRow);
      }).pipe(Effect.orDie),

    findPrimary: (userId, exchangeSlug) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          `SELECT ea.* FROM exchange_accounts ea
           JOIN exchanges e ON e.id = ea.exchange_id
           WHERE ea.user_id = $1 AND e.slug = $2 AND ea.is_primary = true
           LIMIT 1`,
          [userId, exchangeSlug]
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({
            accountId: `primary@${userId}/${exchangeSlug}`,
          });
        }
        return mapRow(result.rows[0]);
      }).pipe(
        Effect.catch((error: unknown) => {
          return Match.value(error).pipe(
            Match.when({ _tag: "AccountNotFound" }, (e) => Effect.fail(e as AccountNotFound)),
            Match.orElse(() => Effect.die(error))
          );
        })
      ),

    findWithDescendants: (accountId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          `WITH RECURSIVE descendants AS (
             SELECT * FROM exchange_accounts WHERE id = $1
             UNION
             SELECT ea.* FROM exchange_accounts ea
             INNER JOIN descendants d ON ea.parent_id = d.id
           )
           SELECT * FROM descendants ORDER BY created_at ASC`,
          [accountId]
        );
        return result.rows.map(mapRow);
      }).pipe(Effect.orDie),

    resolveMasterWallet: (accountId) => resolveMasterWallet(pg, accountId),

    setPrimary: (accountId, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          `WITH target AS (
             SELECT id, exchange_id FROM exchange_accounts
             WHERE id = $1 AND user_id = $2
           ),
           deactivate AS (
             UPDATE exchange_accounts SET is_primary = false
             WHERE user_id = $2
               AND exchange_id = (SELECT exchange_id FROM target)
               AND is_primary = true
           )
           UPDATE exchange_accounts SET is_primary = true
           WHERE id = $1 AND user_id = $2
           RETURNING id`,
          [accountId, userId]
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({ accountId });
        }
      }).pipe(
        Effect.catch((error: unknown) => {
          return Match.value(error).pipe(
            Match.when({ _tag: "AccountNotFound" }, (e) => Effect.fail(e as AccountNotFound)),
            Match.orElse(() => Effect.die(error))
          );
        })
      ),

    deactivate: (accountId, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          "UPDATE exchange_accounts SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id",
          [accountId, userId]
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({ accountId });
        }
      }).pipe(
        Effect.catch((error: unknown) => {
          return Match.value(error).pipe(
            Match.when({ _tag: "AccountNotFound" }, (e) => Effect.fail(e as AccountNotFound)),
            Match.orElse(() => Effect.die(error))
          );
        })
      ),
  };
}

function mapRow(row: unknown): ExchangeAccount {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    userId: r.user_id as string,
    exchangeId: r.exchange_id as string,
    nodeType: r.node_type as "wallet" | "sub" | "vault",
    parentId: (r.parent_id as string | undefined) ?? undefined,
    walletAddress: r.wallet_address as string,
    chain: (r.chain as string | undefined) ?? undefined,
    label: r.label as string,
    color: (r.color as string | undefined) ?? undefined,
    sortOrder: r.sort_order as number,
    isActive: r.is_active as boolean,
    isPrimary: r.is_primary as boolean,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}
