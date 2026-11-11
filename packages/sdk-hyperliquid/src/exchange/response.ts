/**
 * @hyperliquid-api POST /exchange (response envelope)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/error-responses.md
 */

import { ValidationError } from "../core/errors";
import { arr, num, obj, str } from "../core/parse";

export type OrderStatus =
  | { resting: { oid: number; cloid?: string } }
  | { filled: { totalSz: string; avgPx: string; oid: number; cloid?: string } }
  | { error: string };

export type BatchStatus = OrderStatus | "waitingForFill" | "waitingForTrigger" | "success";

export type ExchangeOk =
  | {
      status: "ok";
      response: { type: "order"; data: { statuses: readonly BatchStatus[] } };
    }
  | {
      status: "ok";
      response: {
        type: "cancel" | "cancelByCloid" | "batchModify";
        data: { statuses: readonly BatchStatus[] };
      };
    }
  | { status: "ok"; response: { type: "default" } };

export type ExchangeErr = { status: "err"; response: string };

export type ExchangeResponse = ExchangeOk | ExchangeErr;

export function assertNever(x: never): never {
  throw new ValidationError("assertNever", `unexpected variant ${JSON.stringify(x)}`);
}

export { ORDER_ERROR_STRINGS } from "../core/errors";

const optionalCloid = (record: Record<string, unknown>, path: string): { cloid?: string } => {
  const value = record["cloid"];
  if (value === undefined) return {};
  return { cloid: str(value, `${path}.cloid`) };
};

const parseResting = (u: unknown, path: string): OrderStatus => {
  const record = obj(u, path);
  return {
    resting: {
      oid: num(record["oid"], `${path}.oid`),
      ...optionalCloid(record, path),
    },
  };
};

const parseFilled = (u: unknown, path: string): OrderStatus => {
  const record = obj(u, path);
  return {
    filled: {
      totalSz: str(record["totalSz"], `${path}.totalSz`),
      avgPx: str(record["avgPx"], `${path}.avgPx`),
      oid: num(record["oid"], `${path}.oid`),
      ...optionalCloid(record, path),
    },
  };
};

const parseBatchStatus = (u: unknown, path: string): BatchStatus => {
  if (typeof u === "string") {
    if (u === "waitingForFill" || u === "waitingForTrigger" || u === "success") return u;
    throw new ValidationError(path, "waitingForFill | waitingForTrigger | success");
  }
  const record = obj(u, path);
  if (record["resting"] !== undefined) return parseResting(record["resting"], `${path}.resting`);
  if (record["filled"] !== undefined) return parseFilled(record["filled"], `${path}.filled`);
  if (record["error"] !== undefined) return { error: str(record["error"], `${path}.error`) };
  throw new ValidationError(path, "resting | filled | error");
};

const parseStatuses = (u: unknown, path: string): readonly BatchStatus[] =>
  arr(u, path).map((status, index) => parseBatchStatus(status, `${path}[${index}]`));

export function parseExchange(u: unknown): ExchangeResponse {
  const root = obj(u, "exchange");
  const status = str(root["status"], "status");
  if (status === "err") {
    return { status: "err", response: str(root["response"], "response") };
  }
  if (status === "ok") {
    const response = obj(root["response"], "response");
    const type = str(response["type"], "response.type");
    if (type === "default") return { status: "ok", response: { type: "default" } };
    if (type === "order") {
      const data = obj(response["data"], "response.data");
      return {
        status: "ok",
        response: {
          type: "order",
          data: { statuses: parseStatuses(data["statuses"], "response.data.statuses") },
        },
      };
    }
    if (type === "cancel" || type === "cancelByCloid" || type === "batchModify") {
      const data = obj(response["data"], "response.data");
      return {
        status: "ok",
        response: {
          type,
          data: { statuses: parseStatuses(data["statuses"], "response.data.statuses") },
        },
      };
    }
    throw new ValidationError(
      "response.type",
      "order | cancel | cancelByCloid | batchModify | default",
    );
  }
  throw new ValidationError("status", "ok | err");
}

export function errorsOf(r: ExchangeResponse): readonly string[] {
  if (r.status === "err") return [r.response];
  const response = r.response;
  switch (response.type) {
    case "default":
      return [];
    case "order":
    case "cancel":
    case "cancelByCloid":
    case "batchModify":
      return response.data.statuses.flatMap((status) => {
        const error = batchStatusError(status);
        return error === undefined ? [] : [error];
      });
  }
  return assertNever(response);
}

const orderStatusError = (status: OrderStatus): string | undefined => {
  if ("error" in status) return status.error;
  if ("resting" in status) return undefined;
  if ("filled" in status) return undefined;
  return assertNever(status);
};

const batchStatusError = (status: BatchStatus): string | undefined => {
  if (typeof status === "string") {
    switch (status) {
      case "waitingForFill":
      case "waitingForTrigger":
      case "success":
        return undefined;
    }
    return assertNever(status);
  }
  return orderStatusError(status);
};
