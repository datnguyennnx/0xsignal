/**
 * Leaf bridge between the HTTP layer and the auth store.
 *
 * The store owns the token; `lib/api-base` and the API client only need to read
 * and write it. Holding that contract here keeps both sides free of a module
 * cycle (`store -> api -> store`).
 */
interface AuthTokenBridge {
  read: () => string | null;
  write: (token: string | null) => void;
}

let bridge: AuthTokenBridge | null = null;

export function registerAuthTokenBridge(next: AuthTokenBridge): void {
  bridge = next;
}

export function readAuthToken(): string | null {
  return bridge === null ? null : bridge.read();
}

export function writeAuthToken(token: string | null): void {
  bridge?.write(token);
}
