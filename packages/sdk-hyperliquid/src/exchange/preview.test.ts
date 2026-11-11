import { describe, expect, test } from "bun:test";
import { asAddress, asDecimal, asHex } from "../core/brands";
import {
  asL1Action,
  encodeL1Action,
  l1ActionDigest,
  l1ActionHashHex,
  type Digest32,
  type L1Action,
  type L1TypedData,
} from "../core/eip712";
import { NonceSource } from "../core/nonce";
import { cast } from "../core/parse";
import { Transport } from "../core/transport";
import { toWirePrice, toWireSize } from "../core/trade-rules";
import {
  Signer,
  type TypedDataSignature,
  type TypedDataSigner,
  type WalletTypedData,
} from "../signing";
import { encodeUpdateLeverage } from "./actions/update-leverage";
import { ExchangeClient, type DigestEnvelope } from "./client";
const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const NOW = 1_700_000_000_000;
const WALLET_ADDRESS = "0x3333333333333333333333333333333333333333";
const DESTINATION = asAddress("0x2222222222222222222222222222222222222222");

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const PRIVATE_KEY = bytesFromHex(PRIVATE_KEY_HEX);
const signer = new Signer({ privateKey: PRIVATE_KEY });

const ORDER_RESPONSE = {
  status: "ok",
  response: { type: "order", data: { statuses: ["success"] } },
};
const OK_DEFAULT = { status: "ok", response: { type: "default" } };

class FakeTransport extends Transport {
  readonly payload: unknown;
  readonly bodies: Record<string, unknown>[] = [];
  readonly events: string[];

  constructor(payload: unknown, events: string[] = []) {
    super({ retries: 0 });
    this.payload = payload;
    this.events = events;
  }

  override postExchange<T>(
    body: Record<string, unknown>,
    parse: (u: unknown) => T,
    _batchLength: number,
  ): Promise<T> {
    this.events.push("post");
    this.bodies.push(body);
    return Promise.resolve().then(() => parse(this.payload));
  }
}

const limitOrder = () => ({
  a: 4,
  b: true,
  p: toWirePrice(asDecimal("1100"), 5, "perp"),
  s: toWireSize(asDecimal("0.1"), 5),
  r: false,
  t: { limit: { tif: "Gtc" as const } },
});

const orderAction = () => ({ orders: [limitOrder()], grouping: "na" as const });
const leverageAction = () => ({ asset: 0, isCross: true, leverage: 10 });

const requireEnvelope = (envelopes: readonly DigestEnvelope[]): DigestEnvelope => {
  const [envelope] = envelopes;
  if (envelope === undefined) throw new Error("onDigest was not called");
  return envelope;
};

const requireBody = (bodies: readonly Record<string, unknown>[]): Record<string, unknown> => {
  const [body] = bodies;
  if (body === undefined) throw new Error("no exchange body was posted");
  return body;
};

const requireDigest = (digests: readonly Digest32[]): Digest32 => {
  const [digest] = digests;
  if (digest === undefined) throw new Error("onDigest delivered no digest");
  return digest;
};

const expiresAfterOf = (envelope: DigestEnvelope): bigint | null =>
  envelope.expiresAfter === undefined ? null : BigInt(envelope.expiresAfter);

const vaultOf = (envelope: DigestEnvelope): string | null => envelope.vaultAddress ?? null;

const STUB_SIGNATURE: TypedDataSignature = {
  r: `0x${"11".repeat(32)}`,
  s: `0x${"22".repeat(32)}`,
  v: 27,
};

const recordingWallet = (events: string[]): TypedDataSigner => ({
  address: WALLET_ADDRESS,
  signTypedData(_data: L1TypedData | WalletTypedData): Promise<TypedDataSignature> {
    events.push("sign");
    return Promise.resolve(STUB_SIGNATURE);
  },
});

describe("digest envelope binding", () => {
  test("mutating the envelope action throws and the posted body is unchanged", async () => {
    const transport = new FakeTransport(ORDER_RESPONSE);
    const envelopes: DigestEnvelope[] = [];
    const client = new ExchangeClient({
      transport,
      signer,
      onDigest: (_digest, envelope) => {
        envelopes.push(envelope);
      },
    });

    await client.order(orderAction());

    const envelope = requireEnvelope(envelopes);
    const action = cast<Record<string, unknown>>(envelope.action, "envelope.action");
    expect(Object.isFrozen(envelope.action)).toBe(true);
    expect(() => {
      action["tampered"] = true;
    }).toThrow();

    const body = requireBody(transport.bodies);
    expect(body["action"]).toEqual(envelope.action);
    expect(
      cast<Record<string, unknown>>(body["action"], "body.action")["tampered"],
    ).toBeUndefined();
  });

  test("onDigest fires before the L1 wallet signer is called", async () => {
    const events: string[] = [];
    const transport = new FakeTransport(OK_DEFAULT, events);
    const client = new ExchangeClient({
      transport,
      wallet: recordingWallet(events),
      nonce: new NonceSource({ now: () => NOW }),
      onDigest: () => {
        events.push("digest");
      },
    });

    await client.updateLeverage(leverageAction());

    expect(events).toEqual(["digest", "sign", "post"]);
  });

  test("onDigest fires before the user-signed wallet signer is called", async () => {
    const events: string[] = [];
    const transport = new FakeTransport(OK_DEFAULT, events);
    const client = new ExchangeClient({
      transport,
      wallet: recordingWallet(events),
      onDigest: () => {
        events.push("digest");
      },
    });

    await client.usdSend({
      destination: DESTINATION,
      amount: asDecimal("1"),
      time: NOW,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0x1",
    });

    expect(events).toEqual(["digest", "sign", "post"]);
  });

  test("the envelope connectionId matches l1ActionHashHex and the typed data", async () => {
    const transport = new FakeTransport(OK_DEFAULT);
    const envelopes: DigestEnvelope[] = [];
    const client = new ExchangeClient({
      transport,
      signer,
      nonce: new NonceSource({ now: () => NOW }),
      onDigest: (_digest, envelope) => {
        envelopes.push(envelope);
      },
    });

    const action = leverageAction();
    await client.updateLeverage(action);

    const envelope = requireEnvelope(envelopes);
    const expectedArgs = {
      action: encodeL1Action(asL1Action(encodeUpdateLeverage(action))),
      nonce: BigInt(NOW),
    };
    const expectedConnectionId = l1ActionHashHex(expectedArgs);
    expect(envelope.connectionId).toBe(asHex(expectedConnectionId));
    const typed = cast<L1TypedData>(envelope.typedData, "envelope.typedData");
    expect(typed.message.connectionId).toBe(expectedConnectionId);
  });

  test("preview returns the same digest for the same action and nonce", async () => {
    const transport = new FakeTransport(OK_DEFAULT);
    const envelopes: DigestEnvelope[] = [];
    const digests: Digest32[] = [];
    const client = new ExchangeClient({
      transport,
      signer,
      nonce: new NonceSource({ now: () => NOW }),
      onDigest: (digest, envelope) => {
        digests.push(digest);
        envelopes.push(envelope);
      },
    });

    const action = leverageAction();
    const preview = client.preview(action, { nonce: NOW });
    await client.updateLeverage(action);

    const realDigest = requireDigest(digests);
    const previewAction = cast<L1Action>(preview.envelope.action, "preview.action");
    const previewDigest = l1ActionDigest({
      action: encodeL1Action(previewAction),
      nonce: BigInt(preview.envelope.nonce),
      vault: vaultOf(preview.envelope),
      expiresAfter: expiresAfterOf(preview.envelope),
      isTestnet: preview.envelope.isTestnet,
    });

    const realEnvelope = requireEnvelope(envelopes);
    expect(bytesEqual(previewDigest, realDigest)).toBe(true);
    expect(preview.envelope.connectionId).toBe(realEnvelope.connectionId);
    expect(realEnvelope.nonce).toBe(NOW);
    expect(preview.noop).toBe(true);
  });

  test("preview without an explicit nonce does not advance the nonce source", async () => {
    const transport = new FakeTransport(OK_DEFAULT);
    const envelopes: DigestEnvelope[] = [];
    const client = new ExchangeClient({
      transport,
      signer,
      nonce: new NonceSource({ now: () => NOW }),
      onDigest: (_digest, envelope) => {
        envelopes.push(envelope);
      },
    });

    client.preview(leverageAction());
    await client.updateLeverage(leverageAction());

    expect(requireEnvelope(envelopes).nonce).toBe(NOW);
  });

  test("the envelope source tracks the signing network", async () => {
    const mainnetEnvelopes: DigestEnvelope[] = [];
    const mainnet = new ExchangeClient({
      transport: new FakeTransport(OK_DEFAULT),
      signer,
      nonce: new NonceSource({ now: () => NOW }),
      onDigest: (_digest, envelope) => {
        mainnetEnvelopes.push(envelope);
      },
    });
    await mainnet.updateLeverage(leverageAction());
    const mainnetEnvelope = requireEnvelope(mainnetEnvelopes);
    expect(mainnetEnvelope.isTestnet).toBe(false);
    expect(mainnetEnvelope.source).toBe("a");
    expect(cast<L1TypedData>(mainnetEnvelope.typedData, "typedData").message.source).toBe("a");

    const testnetEnvelopes: DigestEnvelope[] = [];
    const testnet = new ExchangeClient({
      transport: new FakeTransport(OK_DEFAULT),
      signer: new Signer({ privateKey: PRIVATE_KEY, isTestnet: true }),
      isTestnet: true,
      nonce: new NonceSource({ now: () => NOW }),
      onDigest: (_digest, envelope) => {
        testnetEnvelopes.push(envelope);
      },
    });
    await testnet.updateLeverage(leverageAction());
    const testnetEnvelope = requireEnvelope(testnetEnvelopes);
    expect(testnetEnvelope.isTestnet).toBe(true);
    expect(testnetEnvelope.source).toBe("b");
    expect(cast<L1TypedData>(testnetEnvelope.typedData, "typedData").message.source).toBe("b");
  });
});
