import { http, createConfig } from "wagmi";
import { mainnet, arbitrum } from "wagmi/chains";
import { metaMask, coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet, arbitrum],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "0xsignal",
        url: typeof window !== "undefined" ? window.location.origin : "https://0xsignal.app",
      },
      extensionOnly: true,
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
