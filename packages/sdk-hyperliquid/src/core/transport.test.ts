import { describe, expect, test } from "bun:test";
import { Transport } from "./transport";

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const urlOf = (input: URL | RequestInfo): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

const stubFetch = (onRequest: (url: string) => Response): typeof fetch =>
  Object.assign(
    (input: URL | RequestInfo, _init?: RequestInit): Promise<Response> =>
      Promise.resolve(onRequest(urlOf(input))),
    { preconnect: (_url: string | URL) => {} },
  );

describe("Transport fetch resolution", () => {
  test("resolves globalThis.fetch at call time when no fetchImpl is given", async () => {
    const transport = new Transport();
    const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = stubFetch((url) => {
      calls.push(url);
      return jsonResponse({ ok: true });
    });
    try {
      const result = await transport.postInfo({ type: "l2Book" }, (u) => u, 2);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("/info");
      expect(result).toEqual({ ok: true });
    } finally {
      globalThis.fetch = original;
    }
  });

  test("prefers an explicit fetchImpl over a later globalThis.fetch", async () => {
    const calls: string[] = [];
    const transport = new Transport({
      fetchImpl: stubFetch((url) => {
        calls.push(`explicit:${url}`);
        return jsonResponse({ source: "explicit" });
      }),
    });
    const original = globalThis.fetch;
    globalThis.fetch = stubFetch((url) => {
      calls.push(`global:${url}`);
      return jsonResponse({ source: "global" });
    });
    try {
      const result = await transport.postInfo({ type: "l2Book" }, (u) => u, 2);
      expect(result).toEqual({ source: "explicit" });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toStartWith("explicit:");
    } finally {
      globalThis.fetch = original;
    }
  });
});
