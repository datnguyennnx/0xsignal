import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import * as appStyles from "./index.css";
import * as katexStyles from "katex/dist/katex.min.css";
import { App } from "./App";
import { config } from "./config/web3";
import { queryClient } from "./lib/query-client";
import { initAppStore } from "./stores/use-app-store";

// Stylesheets are imported for the injection side effect; the bindings keep the
// style imports assigned while the entry still declares what it pulls in.
void appStyles;
void katexStyles;

initAppStore();

const rootEl = document.querySelector<HTMLElement>("#root");
if (rootEl === null) throw new Error("Root element #root not found");
createRoot(rootEl).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
);
