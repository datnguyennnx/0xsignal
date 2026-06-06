import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";
import type { ExchangeAccount } from "../../domain/exchange-credential";
import { AccountNotFound, DuplicateLabel } from "../../domain/errors";
import { EXCHANGE_SLUGS } from "../../domain/exchange-constants";

// Input types

export interface CreateExchangeAccountParams {
  readonly userId: string;
  readonly exchangeSlug: string;
  readonly nodeType: "wallet" | "sub" | "vault";
  readonly parentId?: string;
  readonly walletAddress: string;
  readonly chain?: string;
  readonly label?: string;
  readonly color?: string;
  readonly sortOrder?: number;
  readonly metadata?: Record<string, unknown>;
}

// Port interface

export interface ExchangeAccountRepoPort {
  readonly create: (
    params: CreateExchangeAccountParams
  ) => Effect.Effect<ExchangeAccount, AccountNotFound | DuplicateLabel>;

  readonly findById: (
    id: string,
    userId: string
  ) => Effect.Effect<ExchangeAccount, AccountNotFound>;

  readonly findByUserId: (
    userId: string,
    exchangeSlug?: string
  ) => Effect.Effect<readonly ExchangeAccount[], never>;

  readonly findPrimary: (
    userId: string,
    exchangeSlug: string
  ) => Effect.Effect<ExchangeAccount, AccountNotFound>;

  readonly findWithDescendants: (
    accountId: string
  ) => Effect.Effect<readonly ExchangeAccount[], never>;

  readonly resolveMasterWallet: (accountId: string) => Effect.Effect<string, AccountNotFound>;

  readonly setPrimary: (accountId: string, userId: string) => Effect.Effect<void, AccountNotFound>;

  readonly deactivate: (accountId: string, userId: string) => Effect.Effect<void, AccountNotFound>;
}

// Context Service

export class ExchangeAccountRepo extends Context.Service<
  ExchangeAccountRepo,
  ExchangeAccountRepoPort
>()("ExchangeAccountRepo") {}

// Layer

export const ExchangeAccountRepoLayer: Layer.Layer<
  ExchangeAccountRepo,
  never,
  PostgresConnectionPool
> = Layer.effect(
  ExchangeAccountRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;

    if (pg === null) {
      yield* Effect.logWarning(
        "Postgres not available — using in-memory ExchangeAccountRepo (dev only)"
      );
      return inMemoryExchangeAccountRepo();
    }

    return pgExchangeAccountRepo(pg);
  })
);

// DB row mapping

const mapRow = (row: any): ExchangeAccount => ({
  id: row.id,
  userId: row.user_id,
  exchangeId: row.exchange_id,
  nodeType: row.node_type,
  parentId: row.parent_id ?? undefined,
  walletAddress: row.wallet_address,
  chain: row.chain ?? undefined,
  label: row.label,
  color: row.color ?? undefined,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  isPrimary: row.is_primary,
  metadata: row.metadata ?? {},
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
});

// In-memory implementation (dev mode)

function inMemoryExchangeAccountRepo(): ExchangeAccountRepoPort {
  const accounts = new Map<string, ExchangeAccount>();

  const exchangeIds = new Map<string, string>();
  for (const slug of EXCHANGE_SLUGS) {
    exchangeIds.set(slug, crypto.randomUUID());
  }

  const resolveExchangeId = (slug: string): string | undefined => exchangeIds.get(slug);

  return {
    create: (params) =>
      Effect.gen(function* () {
        const exchangeId = resolveExchangeId(params.exchangeSlug);
        if (!exchangeId) {
          return yield* Effect.fail(
            new AccountNotFound({ accountId: `exchange:${params.exchangeSlug}` })
          );
        }

        const label = params.label ?? "";
        const dup = Array.from(accounts.values()).find(
          (a) => a.userId === params.userId && a.exchangeId === exchangeId && a.label === label
        );
        if (dup) {
          return yield* Effect.fail(new DuplicateLabel({ label }));
        }

        if (params.parentId && !accounts.has(params.parentId)) {
          return yield* Effect.fail(new AccountNotFound({ accountId: params.parentId }));
        }

        const hasExisting = Array.from(accounts.values()).some(
          (a) => a.userId === params.userId && a.exchangeId === exchangeId
        );

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const account: ExchangeAccount = {
          id,
          userId: params.userId,
          exchangeId,
          nodeType: params.nodeType,
          parentId: params.parentId,
          walletAddress: params.walletAddress,
          chain: params.chain,
          label: params.label ?? "",
          color: params.color,
          sortOrder: params.sortOrder ?? 0,
          isActive: true,
          isPrimary: !hasExisting,
          metadata: params.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        };
        accounts.set(id, account);
        return account;
      }),

    findById: (id, userId) =>
      Effect.gen(function* () {
        const account = accounts.get(id);
        if (!account || account.userId !== userId) {
          return yield* Effect.fail(new AccountNotFound({ accountId: id }));
        }
        return account;
      }),

    findByUserId: (userId, exchangeSlug) =>
      Effect.sync(() => {
        let result = Array.from(accounts.values()).filter((a) => a.userId === userId);
        if (exchangeSlug) {
          const exchangeId = resolveExchangeId(exchangeSlug);
          if (exchangeId) {
            result = result.filter((a) => a.exchangeId === exchangeId);
          }
        }
        return result;
      }),

    findPrimary: (userId, exchangeSlug) =>
      Effect.gen(function* () {
        const exchangeId = resolveExchangeId(exchangeSlug);
        if (!exchangeId) {
          return yield* Effect.fail(
            new AccountNotFound({ accountId: `primary@${userId}/${exchangeSlug}` })
          );
        }
        const account = Array.from(accounts.values()).find(
          (a) => a.userId === userId && a.exchangeId === exchangeId && a.isPrimary
        );
        if (!account) {
          return yield* Effect.fail(
            new AccountNotFound({ accountId: `primary@${userId}/${exchangeSlug}` })
          );
        }
        return account;
      }),

    findWithDescendants: (accountId) =>
      Effect.sync(() => {
        const result: ExchangeAccount[] = [];
        const visited = new Set<string>();
        const queue = [accountId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          if (visited.has(currentId)) continue;
          visited.add(currentId);
          const current = accounts.get(currentId);
          if (current) {
            result.push(current);
          }
          for (const acct of accounts.values()) {
            if (acct.parentId === currentId && !visited.has(acct.id)) {
              queue.push(acct.id);
            }
          }
        }
        return result;
      }),

    resolveMasterWallet: (accountId) =>
      Effect.gen(function* () {
        let current = accounts.get(accountId);
        if (!current) {
          return yield* Effect.fail(new AccountNotFound({ accountId }));
        }
        if (current.nodeType === "wallet") {
          return current.walletAddress;
        }
        while (current?.parentId) {
          current = accounts.get(current.parentId);
          if (current?.nodeType === "wallet") {
            return current.walletAddress;
          }
        }
        return yield* Effect.fail(new AccountNotFound({ accountId: `master-wallet:${accountId}` }));
      }),

    setPrimary: (accountId, userId) =>
      Effect.gen(function* () {
        const target = accounts.get(accountId);
        if (!target || target.userId !== userId) {
          return yield* Effect.fail(new AccountNotFound({ accountId }));
        }

        const exchangeId = target.exchangeId;

        for (const [id, acct] of accounts) {
          if (acct.userId === userId && acct.exchangeId === exchangeId && acct.isPrimary) {
            accounts.set(id, {
              ...acct,
              isPrimary: false,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        accounts.set(accountId, {
          ...target,
          isPrimary: true,
          updatedAt: new Date().toISOString(),
        });
      }),

    deactivate: (accountId, userId) =>
      Effect.gen(function* () {
        const account = accounts.get(accountId);
        if (!account || account.userId !== userId) {
          return yield* Effect.fail(new AccountNotFound({ accountId }));
        }
        accounts.set(accountId, {
          ...account,
          isActive: false,
          updatedAt: new Date().toISOString(),
        });
      }),
  };
}

// Postgres implementation

function pgExchangeAccountRepo(pg: NonNullable<import("pg").Pool>): ExchangeAccountRepoPort {
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
          if (error instanceof AccountNotFound || error instanceof DuplicateLabel) {
            return Effect.fail(error);
          }
          return Effect.die(error);
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
          if (error instanceof AccountNotFound) return Effect.fail(error);
          return Effect.die(error);
        })
      ),

    findByUserId: (userId, exchangeSlug) =>
      Effect.tryPromise(async () => {
        let query: string;
        let params: any[];

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
          if (error instanceof AccountNotFound) return Effect.fail(error);
          return Effect.die(error);
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

    resolveMasterWallet: (accountId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          `WITH RECURSIVE chain AS (
             SELECT id, parent_id, node_type, wallet_address
             FROM exchange_accounts WHERE id = $1
             UNION ALL
             SELECT ea.id, ea.parent_id, ea.node_type, ea.wallet_address
             FROM exchange_accounts ea
             INNER JOIN chain c ON c.parent_id = ea.id
           )
           SELECT wallet_address FROM chain WHERE node_type = 'wallet' LIMIT 1`,
          [accountId]
        );
        if (result.rows.length === 0) {
          throw new AccountNotFound({
            accountId: `master-wallet:${accountId}`,
          });
        }
        return result.rows[0].wallet_address;
      }).pipe(
        Effect.catch((error: unknown) => {
          if (error instanceof AccountNotFound) return Effect.fail(error);
          return Effect.die(error);
        })
      ),

    setPrimary: (accountId, userId) =>
      Effect.tryPromise(async () => {
        // Atomic: deactivate + set primary
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
          if (error instanceof AccountNotFound) return Effect.fail(error);
          return Effect.die(error);
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
          if (error instanceof AccountNotFound) return Effect.fail(error);
          return Effect.die(error);
        })
      ),
  };
}

// Helpers

function isPgUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as any).code === "23505";
}
