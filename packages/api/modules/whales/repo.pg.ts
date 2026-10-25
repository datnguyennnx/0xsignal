import { Effect, Layer } from "effect";
import type { WhalePosition, WhalePositionsQuery, WhalePositionSort } from "@0xsignal/shared";
import {
  WHALE_POSITIONS_LIMIT_DEFAULT,
  WHALE_POSITIONS_LIMIT_MAX,
  WHALE_POSITIONS_LIMIT_MIN,
} from "@0xsignal/shared";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { WhaleRepo, WhaleRepoError, type WhalePositionsPage, type WhaleRepoPort } from "./repo";

// Postgres caps a statement at 65535 bound parameters; chunking keeps each
// statement well under that while still batching many rows per round trip.
const MAX_ROWS_PER_STATEMENT = 500;

const chunked = <T>(values: readonly T[]): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += MAX_ROWS_PER_STATEMENT) {
    chunks.push(values.slice(i, i + MAX_ROWS_PER_STATEMENT));
  }
  return chunks;
};

const sum = (counts: readonly number[]): number =>
  counts.reduce((total, count) => total + count, 0);

const WALLET_COLUMNS = ["address", "last_trade_at", "last_notional_usd"];
const WALLET_ASSIGNMENTS = [
  "last_trade_at = EXCLUDED.last_trade_at",
  "last_notional_usd = EXCLUDED.last_notional_usd",
];

const POSITION_COLUMNS = [
  "user_address",
  "coin",
  "side",
  "size",
  "notional_usd",
  "entry_px",
  "liquidation_px",
  "leverage",
  "leverage_type",
  "margin_usd",
  "unrealized_pnl",
  "unrealized_pnl_pct",
  "funding_fee",
  "mark_price",
  "entry_time",
];
const POSITION_ASSIGNMENTS = [
  ...POSITION_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`),
  "updated_at = now()",
];

const SORT_EXPR: Record<WhalePositionSort, string> = {
  notional: "notional_usd",
  pnl: "unrealized_pnl",
  funding: "COALESCE(funding_fee, 0)",
};

type Pool = NonNullable<import("pg").Pool>;

function pgWhaleRepo(pg: Pool): WhaleRepoPort {
  return {
    upsertWallets: (wallets) =>
      Effect.tryPromise({
        try: () =>
          batchedUpsert(
            pg,
            "whale_wallets",
            WALLET_COLUMNS,
            "(address)",
            WALLET_ASSIGNMENTS,
            wallets.map((w) => [w.address, w.lastTradeAt ?? null, w.lastNotionalUsd ?? null]),
          ),
        catch: (cause) => new WhaleRepoError({ message: "Failed to upsert whale wallets", cause }),
      }),

    upsertPositions: (positions) =>
      Effect.tryPromise({
        try: () =>
          batchedUpsert(
            pg,
            "whale_positions",
            POSITION_COLUMNS,
            "(user_address, coin)",
            POSITION_ASSIGNMENTS,
            positions.map((position) => positionRow(position)),
          ),
        catch: (cause) =>
          new WhaleRepoError({ message: "Failed to upsert whale positions", cause }),
      }),

    deleteClosedPositions: (keys) =>
      Effect.tryPromise({
        try: () => deletePositionKeys(pg, keys),
        catch: (cause) =>
          new WhaleRepoError({ message: "Failed to delete closed whale positions", cause }),
      }),

    queryPositions: (q) =>
      Effect.tryPromise({
        try: () => runPositionsQuery(pg, q),
        catch: (cause) => new WhaleRepoError({ message: "Failed to query whale positions", cause }),
      }),

    pruneWallets: (before) =>
      Effect.tryPromise({
        try: () => pruneWallets(pg, before),
        catch: (cause) => new WhaleRepoError({ message: "Failed to prune whale wallets", cause }),
      }),

    deletePositionsForAddresses: (addresses) =>
      Effect.tryPromise({
        try: () => deletePositionsForAddresses(pg, addresses),
        catch: (cause) =>
          new WhaleRepoError({ message: "Failed to delete whale positions by address", cause }),
      }),

    pruneStalePositions: (before) =>
      Effect.tryPromise({
        try: () => pruneStalePositions(pg, before),
        catch: (cause) =>
          new WhaleRepoError({ message: "Failed to prune stale whale positions", cause }),
      }),
  };
}

// A wallet is stale when its most recent activity, `last_trade_at`, predates
// the cutoff. Wallets with no recorded trade are never pruned.
async function pruneWallets(pg: Pool, before: Date): Promise<number> {
  const result = await pg.query("DELETE FROM whale_wallets WHERE last_trade_at < $1", [before]);
  return result.rowCount ?? 0;
}

async function deletePositionsForAddresses(
  pg: Pool,
  addresses: readonly string[],
): Promise<number> {
  const counts = await Promise.all(
    chunked(addresses).map(async (chunk) => {
      const result = await pg.query("DELETE FROM whale_positions WHERE user_address = ANY($1)", [
        chunk,
      ]);
      return result.rowCount ?? 0;
    }),
  );
  return sum(counts);
}

async function pruneStalePositions(pg: Pool, before: Date): Promise<number> {
  const result = await pg.query("DELETE FROM whale_positions WHERE updated_at < $1", [before]);
  return result.rowCount ?? 0;
}

function positionRow(p: WhalePosition): readonly unknown[] {
  return [
    p.userAddress,
    p.coin,
    p.side,
    p.size,
    p.notionalUsd,
    p.entryPx,
    p.liquidationPx ?? null,
    p.leverage ?? null,
    p.leverageType ?? null,
    p.marginUsd ?? null,
    p.unrealizedPnl,
    p.unrealizedPnlPct,
    p.fundingFee ?? null,
    p.markPrice ?? null,
    p.entryTime,
  ];
}

async function deletePositionKeys(
  pg: Pool,
  keys: readonly { readonly userAddress: string; readonly coin: string }[],
): Promise<number> {
  const counts = await Promise.all(
    chunked(keys).map(async (chunk) => {
      const params: unknown[] = [];
      const tuples = chunk.map(
        (key) => `(${bindParam(params, key.userAddress)}, ${bindParam(params, key.coin)})`,
      );
      const sql = `DELETE FROM whale_positions WHERE (user_address, coin) IN (${tuples.join(", ")})`;
      const result = await pg.query(sql, params);
      return result.rowCount ?? 0;
    }),
  );
  return sum(counts);
}

async function runPositionsQuery(pg: Pool, q: WhalePositionsQuery): Promise<WhalePositionsPage> {
  const params: unknown[] = [];
  const bind = (value: unknown): string => bindParam(params, value);
  const conditions = positionFilterConditions(q, params);

  const sort = q.sort ?? "notional";
  const sortExpr = SORT_EXPR[sort];
  const decoded = q.cursor === undefined ? null : decodeCursor(q.cursor);
  if (decoded !== null) {
    const [sortValue, userAddress, coin] = decoded;
    conditions.push(
      `(${sortExpr}, user_address, coin) < (${bind(sortValue)}, ${bind(userAddress)}, ${bind(coin)})`,
    );
  }

  const limit = Math.min(
    Math.max(q.limit ?? WHALE_POSITIONS_LIMIT_DEFAULT, WHALE_POSITIONS_LIMIT_MIN),
    WHALE_POSITIONS_LIMIT_MAX,
  );
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const sql =
    `SELECT * FROM whale_positions${where}` +
    ` ORDER BY ${sortExpr} DESC, user_address ASC, coin ASC LIMIT ${bind(limit + 1)}`;

  const result = await pg.query<WhalePositionRow>(sql, params);
  const rows = result.rows;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > limit && last !== undefined
      ? encodeCursor(positionSortValue(last, sort), last.user_address, last.coin)
      : null;

  return { positions: page.map((row) => mapPositionRow(row)), nextCursor };
}

function positionFilterConditions(q: WhalePositionsQuery, params: unknown[]): string[] {
  const conditions: string[] = [];
  const bind = (value: unknown): string => bindParam(params, value);

  if (q.symbol !== undefined) conditions.push(`coin = ${bind(q.symbol)}`);
  if (q.side !== undefined) conditions.push(`side = ${bind(q.side)}`);
  if (q.pnlMin !== undefined) conditions.push(`unrealized_pnl >= ${bind(q.pnlMin)}`);
  if (q.pnlMax !== undefined) conditions.push(`unrealized_pnl <= ${bind(q.pnlMax)}`);
  if (q.fundingMin !== undefined) conditions.push(`funding_fee >= ${bind(q.fundingMin)}`);

  return conditions;
}

async function batchedUpsert(
  pg: Pool,
  table: string,
  columns: readonly string[],
  conflictTarget: string,
  assignments: readonly string[],
  rows: readonly (readonly unknown[])[],
): Promise<number> {
  const counts = await Promise.all(
    chunked(rows).map(async (chunk) => {
      const params: unknown[] = [];
      const tuples = chunk.map(
        (row) => `(${row.map((value) => bindParam(params, value)).join(", ")})`,
      );
      const sql =
        `INSERT INTO ${table} (${columns.join(", ")})\n` +
        `VALUES ${tuples.join(", ")}\n` +
        `ON CONFLICT ${conflictTarget} DO UPDATE SET ${assignments.join(", ")}`;

      await pg.query(sql, params);
      return chunk.length;
    }),
  );
  return sum(counts);
}

function bindParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

// pg returns numeric/decimal columns as strings; coerce before they reach the domain model.
function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function toOptionalNumber(value: string | number | null): number | undefined {
  const n = value == null ? Number.NaN : toNumber(value);
  return Number.isNaN(n) ? undefined : n;
}

function toLeverageType(value: string | null): "cross" | "isolated" | undefined {
  return value === "cross" || value === "isolated" ? value : undefined;
}

interface WhalePositionRow {
  [column: string]: unknown;
  user_address: string;
  coin: string;
  side: WhalePosition["side"];
  size: string | number;
  notional_usd: string | number;
  entry_px: string;
  liquidation_px: string | null;
  leverage: string | number | null;
  leverage_type: string | null;
  margin_usd: string | number | null;
  unrealized_pnl: string | number;
  unrealized_pnl_pct: string | number;
  funding_fee: string | number | null;
  mark_price: string | null;
  entry_time: Date | string;
}

function mapPositionRow(row: WhalePositionRow): WhalePosition {
  return {
    userAddress: row.user_address,
    coin: row.coin,
    side: row.side,
    size: toNumber(row.size),
    notionalUsd: toNumber(row.notional_usd),
    entryPx: row.entry_px,
    liquidationPx: row.liquidation_px ?? undefined,
    leverage: toOptionalNumber(row.leverage),
    leverageType: toLeverageType(row.leverage_type),
    marginUsd: toOptionalNumber(row.margin_usd),
    unrealizedPnl: toNumber(row.unrealized_pnl),
    unrealizedPnlPct: toNumber(row.unrealized_pnl_pct),
    fundingFee: toOptionalNumber(row.funding_fee),
    markPrice: row.mark_price ?? undefined,
    entryTime: toIsoString(row.entry_time),
  };
}

function positionSortValue(row: WhalePositionRow, sort: WhalePositionSort): number {
  const value =
    sort === "pnl"
      ? row.unrealized_pnl
      : sort === "funding"
        ? (row.funding_fee ?? 0)
        : row.notional_usd;
  return toNumber(value);
}

function encodeCursor(sortValue: number, userAddress: string, coin: string): string {
  return Buffer.from(JSON.stringify([sortValue, userAddress, coin]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): [number, string, string] | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      typeof parsed[0] === "number" &&
      typeof parsed[1] === "string" &&
      typeof parsed[2] === "string"
    ) {
      return [parsed[0], parsed[1], parsed[2]];
    }
    return null;
  } catch {
    return null;
  }
}

export const WhaleRepoLayer: Layer.Layer<WhaleRepo, never, PostgresConnectionPool> = Layer.effect(
  WhaleRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;

    if (pg === null) {
      return yield* Effect.die(
        new Error("PostgresConnectionPool required but was null — provide a proper pool"),
      );
    }

    return pgWhaleRepo(pg);
  }),
);
