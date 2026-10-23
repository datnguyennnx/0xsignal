import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: path.resolve(import.meta.dirname, "dist/stats.html"),
      projectRoot: import.meta.dirname,
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "viem", "wagmi"],
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  // Every entry is reachable from the first paint (main.tsx -> App.tsx -> use-auth-store
  // -> the api barrel), so pre-bundling them up front removes the discovery reload.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "viem",
      "wagmi",
      "lucide-react",
      "cn",
      "sonner",
    ],
  },
  server: {
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/features/chart/components/trading-chart.tsx",
        "./src/pages/asset-detail.tsx",
      ],
    },
    proxy: {
      "/api": { target: "http://localhost:9006", changeOrigin: true, ws: true },
    },
  },
  preview: {
    proxy: {
      "/api": { target: "http://localhost:9006", changeOrigin: true, ws: true },
    },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-lightweight-charts",
              test: /node_modules[\\/]lightweight-charts[\\/]/,
              priority: 3,
              minSize: 20_000,
            },
            {
              name: "vendor-viem-wagmi",
              test: /node_modules[\\/](viem|wagmi)[\\/]/,
              priority: 2,
              minSize: 20_000,
            },
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 1,
              minSize: 20_000,
            },
          ],
        },
      },
    },
  },
});
