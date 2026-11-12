import { http, createConfig } from "wagmi";
import { mainnet, arbitrum } from "wagmi/chains";
import { metaMask, coinbaseWallet, injected } from "wagmi/connectors";

function createWeb3Config() {
  return createConfig({
    chains: [mainnet, arbitrum],
    connectors: [
      injected(),
      metaMask({
        dapp: {
          name: "0xsignal",
          url: typeof window === "undefined" ? "https://0xsignal.app" : window.location.origin,
        },
      }),
      coinbaseWallet({}),
    ],
    transports: {
      [mainnet.id]: http(),
      [arbitrum.id]: http(),
    },
  });
}

export type Web3Config = ReturnType<typeof createWeb3Config>;

const config = /* @__PURE__ */ createWeb3Config();

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

/**
 * The wallet stack's entry point. One config instance per tab, so two callers can
 * never end up with two connector registries and a duplicated WalletConnect core.
 */
export function loadWeb3Config(): Promise<Web3Config> {
  return Promise.resolve(config);
}
