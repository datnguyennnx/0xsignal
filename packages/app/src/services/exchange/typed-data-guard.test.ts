/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import type { L1TypedData } from "@0xsignal/sdk-hyperliquid/signing";
import { concat, recoverTypedDataAddress, toHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import {
  ARBITRUM_CHAIN_ID,
  BLOCKED_SIGNATURE_MESSAGE,
  UntrustedSignatureError,
  WrongChainError,
  assertAgentExchangePayload,
  createGuardedWallet,
  describeSigningError,
  findBlockedSignatureError,
  type ExchangeTypedData,
  type GuardedWalletDeps,
} from "./typed-data-guard";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const account = mnemonicToAccount("test test test test test test test test test test test junk");
const connectionId: `0x${string}` = `0x${"11".repeat(32)}`;

const validPayload = (): L1TypedData => ({
  domain: { name: "Exchange", version: "1", chainId: 1337, verifyingContract: ZERO_ADDRESS },
  types: {
    Agent: [
      { name: "source", type: "string" },
      { name: "connectionId", type: "bytes32" },
    ],
  },
  primaryType: "Agent",
  message: { source: "a", connectionId },
});

const withPayload = (mutate: (payload: ExchangeTypedData) => unknown): ExchangeTypedData =>
  mutate(validPayload()) as ExchangeTypedData;

const guardError = (payload: ExchangeTypedData): Error | null => {
  try {
    assertAgentExchangePayload(payload);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

const rejectionOf = async (run: () => Promise<unknown>): Promise<Error | null> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

describe("assertAgentExchangePayload", () => {
  test("accepts the L1 Agent payload", () => {
    expect(guardError(validPayload())).toBeNull();
  });

  test("rejects a user-signed Withdraw action", () => {
    const error = guardError(withPayload((p) => ({ ...p, primaryType: "Withdraw" })));
    expect(error).toBeInstanceOf(UntrustedSignatureError);
  });

  test("rejects approveAgent types even with the Agent primary type", () => {
    const error = guardError(
      withPayload((p) => ({
        ...p,
        types: { ...p.types, ApproveAgent: [{ name: "agentAddress", type: "address" }] },
      })),
    );
    expect(error?.message).toMatch(/unexpected EIP-712 type/);
  });

  test("rejects a non-Exchange domain name", () => {
    const error = guardError(
      withPayload((p) => ({ ...p, domain: { ...p.domain, name: "Permit" } })),
    );
    expect(error?.message).toMatch(/domain.name/);
  });

  test("rejects a non-1 domain version", () => {
    const error = guardError(withPayload((p) => ({ ...p, domain: { ...p.domain, version: "2" } })));
    expect(error?.message).toMatch(/domain.version/);
  });

  test("rejects a non-1337 signing domain", () => {
    const error = guardError(withPayload((p) => ({ ...p, domain: { ...p.domain, chainId: 1 } })));
    expect(error?.message).toMatch(/domain.chainId/);
  });

  test("rejects a non-zero verifying contract", () => {
    const error = guardError(
      withPayload((p) => ({
        ...p,
        domain: { ...p.domain, verifyingContract: account.address },
      })),
    );
    expect(error?.message).toMatch(/verifyingContract/);
  });

  test("rejects an altered Agent struct", () => {
    const error = guardError(
      withPayload((p) => ({
        ...p,
        types: {
          ...p.types,
          Agent: [
            { name: "source", type: "string" },
            { name: "nonce", type: "uint256" },
          ],
        },
      })),
    );
    expect(error?.message).toMatch(/Agent type fields/);
  });

  test("rejects extra message fields", () => {
    const error = guardError(
      withPayload((p) => ({
        ...p,
        message: { ...p.message, vaultAddress: account.address },
      })),
    );
    expect(error?.message).toMatch(/beyond source/);
  });

  test("rejects a non-bytes32 connectionId", () => {
    const error = guardError(
      withPayload((p) => ({ ...p, message: { source: "a", connectionId: "0x12" } })),
    );
    expect(error?.message).toMatch(/bytes32/);
  });
});

describe("createGuardedWallet", () => {
  const deps = (
    chainId: number,
  ): { readonly deps: GuardedWalletDeps; readonly calls: () => number } => {
    let calls = 0;
    return {
      calls: () => calls,
      deps: {
        address: account.address,
        signTypedData: (params) => {
          calls += 1;
          return account.signTypedData(
            params as unknown as Parameters<typeof account.signTypedData>[0],
          );
        },
        getChainId: () => Promise.resolve(chainId),
      },
    };
  };

  test("signs on Arbitrum for the Agent payload", async () => {
    const { deps: walletDeps, calls } = deps(ARBITRUM_CHAIN_ID);
    const wallet = createGuardedWallet(walletDeps);
    const payload = validPayload();

    const signature = await wallet.signTypedData(payload);

    expect(signature.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(signature.s).toMatch(/^0x[0-9a-f]{64}$/);
    expect([27, 28]).toContain(signature.v);
    expect(calls()).toBe(1);

    const recovered = await recoverTypedDataAddress({
      domain: {
        ...payload.domain,
        verifyingContract: payload.domain.verifyingContract as `0x${string}`,
      },
      types: payload.types,
      primaryType: "Agent",
      message: payload.message,
      signature: concat([signature.r, signature.s, toHex(signature.v)]),
    } as Parameters<typeof recoverTypedDataAddress>[0]);
    expect(recovered).toBe(account.address);
  });

  test("refuses to sign while the wallet is on another chain", async () => {
    const { deps: walletDeps, calls } = deps(1);
    const wallet = createGuardedWallet(walletDeps);
    expect(await rejectionOf(() => wallet.signTypedData(validPayload()))).toBeInstanceOf(
      WrongChainError,
    );
    expect(calls()).toBe(0);
  });

  test("refuses a malicious payload before the signer is reached", async () => {
    const { deps: walletDeps, calls } = deps(ARBITRUM_CHAIN_ID);
    const wallet = createGuardedWallet(walletDeps);
    const payload = withPayload((p) => ({ ...p, primaryType: "ApproveAgent" }));
    expect(await rejectionOf(() => wallet.signTypedData(payload))).toBeInstanceOf(
      UntrustedSignatureError,
    );
    expect(calls()).toBe(0);
  });
});

describe("blocked signature error", () => {
  test("recognises the directly thrown guard error and surfaces a distinct message", () => {
    const guard = new UntrustedSignatureError('unexpected EIP-712 type "Withdraw"');

    expect(findBlockedSignatureError(guard)).toBe(guard);
    expect(describeSigningError(guard)).toBe(BLOCKED_SIGNATURE_MESSAGE);
    expect(describeSigningError(guard)).toContain("not a trading action");
  });

  test("does not walk the cause chain for a wrapped guard error", () => {
    const guard = new UntrustedSignatureError('unexpected EIP-712 type "Withdraw"');
    const wrapped = new Error("Failed to sign the typed data using the wallet", { cause: guard });

    expect(findBlockedSignatureError(wrapped)).toBeNull();
    expect(describeSigningError(wrapped)).toBe("Failed to sign the typed data using the wallet");
  });

  test("keeps the generic path for genuine wallet rejections", () => {
    const rejection = new Error("User rejected the request");
    expect(findBlockedSignatureError(rejection)).toBeNull();
    expect(describeSigningError(rejection)).toBe("User rejected the request");
  });
});
