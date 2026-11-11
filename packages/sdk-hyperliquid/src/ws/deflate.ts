/**
 * @hyperliquid-api wss://api.hyperliquid.xyz/ws channel "fastAssetCtxs"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions.md
 */

import { ValidationError } from "../core/errors";
import { cast } from "../core/parse";

const MAX_INFLATED_BYTES = 8 * 1024 * 1024;

const decoder = new TextDecoder();

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.codePointAt(i) ?? 0;
  return out;
}

export async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("deflate-raw");
  const reader = stream.readable.getReader();
  const writer = stream.writable.getWriter();

  const collected = drain(reader).then(
    (chunks) => ({ ok: true as const, chunks }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  try {
    await writer.write(new Uint8Array(bytes));
    await writer.close();
  } catch (cause) {
    const outcome = await collected;
    if (!outcome.ok && outcome.error instanceof Error) throw outcome.error;
    throw cause;
  }

  const outcome = await collected;
  if (!outcome.ok) throw outcome.error;
  const chunks = outcome.chunks;
  const out = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.length, 0));
  let at = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    if (chunk === undefined) continue;
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

async function drain(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const result = await reader.read();
    if (result.done) return chunks;
    total += result.value.length;
    if (total > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new ValidationError("fastAssetCtxs", `inflated size <= ${MAX_INFLATED_BYTES} bytes`);
    }
    chunks.push(result.value);
  }
}

type RawAssetCtx = { markPx?: number | string; midPx?: number | string | null };

export async function decodeFastAssetCtxs(
  b64: string,
): Promise<Record<string, { markPx?: number; midPx?: number | null }>> {
  const text = decoder.decode(await inflateRaw(base64ToBytes(b64)));
  const parsed = cast<Record<string, RawAssetCtx>>(JSON.parse(text), "assetCtxs");
  const out: Record<string, { markPx?: number; midPx?: number | null }> = {};
  for (const [coin, ctx] of Object.entries(parsed)) {
    const entry: { markPx?: number; midPx?: number | null } = {};
    if (ctx.markPx !== undefined) entry.markPx = Number(ctx.markPx);
    if (ctx.midPx !== undefined) entry.midPx = ctx.midPx === null ? null : Number(ctx.midPx);
    out[coin] = entry;
  }
  return out;
}
