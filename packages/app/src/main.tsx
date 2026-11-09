import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import * as appStyles from "./index.css";
import { App } from "./App";
import { bootstrap } from "./bootstrap";
import { config } from "./config/web3";
import { queryClient } from "./lib/query-client";

void appStyles;

bootstrap(() => {
  const rootEl = document.querySelector<HTMLElement>("#root");
  if (rootEl === null) throw new Error("Root element #root not found");
  createRoot(rootEl).render(
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>,
  );
});
