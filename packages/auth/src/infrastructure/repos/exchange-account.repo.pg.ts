import { Effect } from "effect";
import type { ExchangeAccount } from "../../domain/exchange-account";
import { AccountNotFound, DuplicateLabel } from "../../domain/errors";
import { isPgUniqueViolation, resolveMasterWallet } from "./shared/pg-utils";
import type { ExchangeAccountRepoPort } from "./exchange-account.repo";

type IdRow = { readonly id: string };

type CountRow = { readonly cnt: number };

type ExchangeAccountRow = {
  readonly id: string;
  readonly user_id: string;
  readonly exchange_id: string;
  readonly node_type: ExchangeAccount["nodeType"];
  readonly parent_id: string | null;
  readonly wallet_address: string;
  readonly chain: string | null;
  readonly label: string;
  readonly color: string | null;
  readonly sort_order: number;
  readonly is_active: boolean;
  readonly is_primary: boolean;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

const isPresent = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== "";

const ts = (v: Date | string): string => (v instanceof Date ? v.toISOString() : v);

function mapRow(row: ExchangeAccountRow): ExchangeAccount {
  return {
    id: row.id,
    userId: row.user_id,
    exchangeId: row.exchange_id,
    nodeType: row.node_type,
    ...(row.parent_id !== null && { parentId: row.parent_id }),
    walletAddress: row.wallet_address,
    ...(row.chain !== null && { chain: row.chain }),
    label: row.label,
    ...(row.color !== null && { color: row.color }),
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isPrimary: row.is_primary,
    metadata: row.metadata ?? {},
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
}

export function pgExchangeAccountRepo(pg: NonNullable<import("pg").Pool>): ExchangeAccountRepoPort {
  return {
    create: (params) =>
      Effect.tryPromise(async () => {
        const exchangeResult = await pg.query<IdRow>("SELECT id FROM exchanges WHERE slug = $1", [
          params.exchangeSlug,
        ]);
        if (exchangeResult.rows.length === 0) {
          throw new AccountNotFound({
            accountId: `exchange:${params.exchangeSlug}`,
          });
        }
        const exchangeId = exchangeResult.rows[0].id;

        if (isPresent(params.parentId)) {
          const parentCheck = await pg.query<IdRow>(
            "SELECT id FROM exchange_accounts WHERE id = $1",
            [params.parentId],
          );
          if (parentCheck.rows.length === 0) {
            throw new AccountNotFound({ accountId: params.parentId });
          }
        }

        const countResult = await pg.query<CountRow>(
          "SELECT COUNT(*)::int AS cnt FROM exchange_accounts WHERE user_id = $1 AND exchange_id = $2",
          [params.userId, exchangeId],
        );
        const isFirst = countResult.rows[0].cnt === 0;

        const insertResult = await pg.query<ExchangeAccountRow>(
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
          ],
        );

        return mapRow(insertResult.rows[0]);
      }).pipe(
        Effect.catch((error: unknown): Effect.Effect<never, AccountNotFound | DuplicateLabel> => {
          if (isPgUniqueViolation(error)) {
            return Effect.fail(new DuplicateLabel({ label: params.label ?? "" }));
          }
          if (error instanceof AccountNotFound) {
            return Effect.fail(error);
          }
          if (error instanceof DuplicateLabel) {
            return Effect.fail(error);
          }
          return Effect.die(error);
        }),
      ),

    findById: (id, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query<ExchangeAccountRow>(
          "SELECT * FROM exchange_accounts WHERE id = $1 AND user_id = $2",
          [id, userId],
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({ accountId: id });
        }
        return mapRow(result.rows[0]);
      }).pipe(
        Effect.catch((error: unknown) =>
          error instanceof AccountNotFound ? Effect.fail(error) : Effect.die(error),
        ),
      ),

    findByUserId: (userId, exchangeSlug) =>
      Effect.tryPromise(async () => {
        let query: string;
        let params: unknown[];

        if (isPresent(exchangeSlug)) {
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

        const result = await pg.query<ExchangeAccountRow>(query, params);
        return result.rows.map(mapRow);
      }).pipe(Effect.orDie),

    findPrimary: (userId, exchangeSlug) =>
      Effect.tryPromise(async () => {
        const result = await pg.query<ExchangeAccountRow>(
          `SELECT ea.* FROM exchange_accounts ea
           JOIN exchanges e ON e.id = ea.exchange_id
           WHERE ea.user_id = $1 AND e.slug = $2 AND ea.is_primary = true
           LIMIT 1`,
          [userId, exchangeSlug],
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({
            accountId: `primary@${userId}/${exchangeSlug}`,
          });
        }
        return mapRow(result.rows[0]);
      }).pipe(
        Effect.catch((error: unknown) =>
          error instanceof AccountNotFound ? Effect.fail(error) : Effect.die(error),
        ),
      ),

    findWithDescendants: (accountId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query<ExchangeAccountRow>(
          `WITH RECURSIVE descendants AS (
             SELECT * FROM exchange_accounts WHERE id = $1
             UNION
             SELECT ea.* FROM exchange_accounts ea
             INNER JOIN descendants d ON ea.parent_id = d.id
           )
           SELECT * FROM descendants ORDER BY created_at ASC`,
          [accountId],
        );
        return result.rows.map(mapRow);
      }).pipe(Effect.orDie),

    resolveMasterWallet: (accountId) => resolveMasterWallet(pg, accountId),

    setPrimary: (accountId, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query<IdRow>(
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
          [accountId, userId],
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({ accountId });
        }
      }).pipe(
        Effect.catch((error: unknown) =>
          error instanceof AccountNotFound ? Effect.fail(error) : Effect.die(error),
        ),
      ),

    deactivate: (accountId, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query<IdRow>(
          "UPDATE exchange_accounts SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id",
          [accountId, userId],
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({ accountId });
        }
      }).pipe(
        Effect.catch((error: unknown) =>
          error instanceof AccountNotFound ? Effect.fail(error) : Effect.die(error),
        ),
      ),
  };
}
