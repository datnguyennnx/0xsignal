import { describe, expect, test } from "bun:test";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  ExchangeClient,
  Signer,
  Transport,
  ValidationError,
  asAddress,
  asDecimal,
  cast,
} from "../index";
import { encodeL1Action, l1ActionDigest, l1ActionHashHex } from "../core/eip712";
import { NonceSource } from "../core/nonce";
import { sign, type EcdsaSignature } from "../core/secp";
import {
  type L1TypedData,
  type TypedDataSignature,
  type TypedDataSigner,
  type WalletTypedData,
} from "../signing";

const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const DESTINATION = asAddress("0x2222222222222222222222222222222222222222");
const WALLET_ADDRESS = "0x3333333333333333333333333333333333333333";
const NOW = 1_700_000_000_000;

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const PRIVATE_KEY = bytesFromHex(PRIVATE_KEY_HEX);
const PUBLIC_KEY = secp256k1.getPublicKey(PRIVATE_KEY, false);
const signer = new Signer({ privateKey: PRIVATE_KEY });

const recoveredBytes = (sig: EcdsaSignature): Uint8Array => {
  const out = new Uint8Array(65);
  out[0] = sig.v - 27;
  out.set(bytesFromHex(sig.r), 1);
  out.set(bytesFromHex(sig.s), 33);
  return out;
};

const verify = (sig: EcdsaSignature, digestBytes: Uint8Array): boolean =>
  secp256k1.verify(recoveredBytes(sig), digestBytes, PUBLIC_KEY, {
    prehash: false,
    lowS: true,
    format: "recovered",
  });

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

const requireBody = (bodies: readonly Record<string, unknown>[]): Record<string, unknown> => {
  const [body] = bodies;
  if (body === undefined) throw new Error("no exchange body was posted");
  return body;
};

const requireTyped = (
  seen: readonly (L1TypedData | WalletTypedData)[],
): L1TypedData | WalletTypedData => {
  const [data] = seen;
  if (data === undefined) throw new Error("wallet did not receive typed data");
  return data;
};

const STUB_SIGNATURE: TypedDataSignature = {
  r: `0x${"11".repeat(32)}`,
  s: `0x${"22".repeat(32)}`,
  v: 27,
};

const walletOf = (
  seen: (L1TypedData | WalletTypedData)[],
  produce: () => TypedDataSignature = () => STUB_SIGNATURE,
): TypedDataSigner => ({
  address: WALLET_ADDRESS,
  signTypedData(data: L1TypedData | WalletTypedData): Promise<TypedDataSignature> {
    seen.push(data);
    return Promise.resolve(produce());
  },
});

describe("wallet/signer exclusivity", () => {
  test("constructing with both a signer and a wallet throws ValidationError", () => {
    const transport = new FakeTransport(OK_DEFAULT);
    expect(() => new ExchangeClient({ transport, signer, wallet: walletOf([]) })).toThrow(
      ValidationError,
    );
  });

  test("constructing with neither a signer nor a wallet throws ValidationError", () => {
    const transport = new FakeTransport(OK_DEFAULT);
    expect(() => new ExchangeClient({ transport })).toThrow(ValidationError);
  });

  test("constructing with a wallet only succeeds", () => {
    const transport = new FakeTransport(OK_DEFAULT);
    const client = new ExchangeClient({ transport, wallet: walletOf([]) });
    expect(client).toBeInstanceOf(ExchangeClient);
  });
});

describe("wallet user-signed path", () => {
  test("signs the HyperliquidTransaction struct and posts the user-signed body", async () => {
    const seen: (L1TypedData | WalletTypedData)[] = [];
    const transport = new FakeTransport(OK_DEFAULT);
    const client = new ExchangeClient({
      transport,
      wallet: walletOf(seen),
      signatureChainId: 42161,
    });
    const time = NOW;

    await client.usdSend({
      destination: DESTINATION,
      amount: asDecimal("1"),
      time,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0x1",
    });

    const typed = requireTyped(seen);
    const message = cast<Record<string, unknown>>(typed.message, "message");
    expect(typed.primaryType).toBe("HyperliquidTransaction:UsdSend");
    expect(Object.keys(typed.types)).toEqual(["HyperliquidTransaction:UsdSend"]);
    expect(message["hyperliquidChain"]).toBe("Mainnet");

    const body = requireBody(transport.bodies);
    const action = cast<Record<string, unknown>>(body["action"], "action");
    expect(Object.keys(action)[0]).toBe("type");
    expect(action["type"]).toBe("usdSend");
    expect(action["hyperliquidChain"]).toBe("Mainnet");
    expect(action["signatureChainId"]).toBe("0xa4b1");
  });
});

describe("wallet L1 path", () => {
  test("produces a signature that verifies against l1ActionDigest", async () => {
    const expectedArgs = {
      action: encodeL1Action({ type: "noop" }),
      nonce: BigInt(NOW),
    };
    const expectedDigest = l1ActionDigest(expectedArgs);
    const expectedSignature = sign(expectedDigest, PRIVATE_KEY);
    const typedSignature: TypedDataSignature = {
      r: `0x${expectedSignature.r.slice(2)}`,
      s: `0x${expectedSignature.s.slice(2)}`,
      v: expectedSignature.v,
    };
    const seen: (L1TypedData | WalletTypedData)[] = [];
    const transport = new FakeTransport(OK_DEFAULT);
    const client = new ExchangeClient({
      transport,
      wallet: walletOf(seen, () => typedSignature),
      nonce: new NonceSource({ now: () => NOW }),
    });

    await client.noop();

    const typed = requireTyped(seen);
    const message = cast<Record<string, unknown>>(typed.message, "message");
    expect(typed.primaryType).toBe("Agent");
    expect(message["connectionId"]).toBe(l1ActionHashHex(expectedArgs));

    const body = requireBody(transport.bodies);
    const posted = cast<EcdsaSignature>(body["signature"], "signature");
    expect(verify(posted, expectedDigest)).toBe(true);
  });
});

describe("onDigest ordering", () => {
  test("the L1 digest callback fires before the wallet signature is posted", async () => {
    const events: string[] = [];
    const transport = new FakeTransport(OK_DEFAULT, events);
    const client = new ExchangeClient({
      transport,
      wallet: walletOf([]),
      nonce: new NonceSource({ now: () => NOW }),
      onDigest: () => {
        events.push("digest");
      },
    });

    await client.noop();

    expect(events).toEqual(["digest", "post"]);
  });

  test("the user-signed digest callback fires before the wallet signature is posted", async () => {
    const events: string[] = [];
    const transport = new FakeTransport(OK_DEFAULT, events);
    const client = new ExchangeClient({
      transport,
      wallet: walletOf([]),
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

    expect(events).toEqual(["digest", "post"]);
  });
});
