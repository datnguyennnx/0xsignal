import { http, createConfig } from "wagmi";
import { mainnet, arbitrum } from "wagmi/chains";
import { metaMask, coinbaseWallet, injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet, arbitrum],
  connectors: [
    injected(),
    metaMask({
      dappMetadata: {
        name: "0xsignal",
        url: typeof window !== "undefined" ? window.location.origin : "https://0xsignal.app",
      },
    }),
    coinbaseWallet({}),
  ],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
