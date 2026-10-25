import type { Server, ServerWebSocket } from "bun";
import type { Effect } from "effect";
import type { HttpError } from "./error-response";

/**
 * The socket lifecycle the transport needs, expressed without any module type.
 * The composition root adapts a concrete hub to this contract.
 */
export interface SocketConnection<D> {
  readonly handleOpen: (ws: ServerWebSocket<D>) => Effect.Effect<void, HttpError>;
  readonly handleClose: (ws: ServerWebSocket<D>) => Effect.Effect<void, HttpError>;
  readonly handleMessage: (
    ws: ServerWebSocket<D>,
    raw: string | Buffer | Uint8Array,
  ) => Effect.Effect<void, HttpError>;
}

export interface WsEventHandlers<D> {
  readonly open: (ws: ServerWebSocket<D>) => void;
  readonly message: (ws: ServerWebSocket<D>, message: string | Buffer) => void;
  readonly pong: (ws: ServerWebSocket<D>) => void;
  readonly close: (ws: ServerWebSocket<D>) => void;
}

export interface WsSetup<D> {
  readonly path: string;
  readonly idleTimeoutSeconds: number;
  readonly upgrade: (url: URL, req: Request, server: Server<D>) => Response | undefined;
  readonly handlers: WsEventHandlers<D>;
}

/**
 * Starts socket work on the application runtime. Bun invokes the socket
 * callbacks outside any Effect context, so the composition root supplies this
 * boundary and the handler logic never starts a runtime of its own.
 */
export type RunSocketWork = (
  effect: Effect.Effect<void, unknown>,
  onError: (error: unknown) => void,
) => void;
