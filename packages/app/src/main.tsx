/**
 * @overview Application Entry Point
 *
 * Bootstraps the React application, provides Web3 and TanStack Query providers,
 * and renders the root component with necessary styles.
 *
 * @mechanism
 * - WagmiProvider: Handles wallet connection and Web3 state
 * - QueryClientProvider: Manages server state and caching
 * - Suspense (in App.tsx): Handles lazy-loaded route components
 */
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import "katex/dist/katex.min.css";
import "./index.css";
import App from "./App";
import { config } from "./config/web3";
import { queryClient } from "./lib/query/client";

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
