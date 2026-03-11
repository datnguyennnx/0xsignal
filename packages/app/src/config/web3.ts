import { http, createConfig } from "wagmi";
import { mainnet, arbitrum } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID as
  | string
  | undefined;

export const config = createConfig({
  chains: [mainnet, arbitrum],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    ...(WALLET_CONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: WALLET_CONNECT_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: "0xSignal",
              description: "AI-powered crypto trading signals",
              url: typeof window !== "undefined" ? window.location.origin : "",
              icons: [typeof window !== "undefined" ? `${window.location.origin}/logo.png` : ""],
            },
          }),
        ]
      : []),
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
