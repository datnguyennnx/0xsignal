import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
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
    chunkSizeWarningLimit: 1500,
    cssCodeSplit: true,
    reportCompressedSize: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-lightweight-charts",
              test: /lightweight-charts/,
              priority: 3,
            },
            {
              name: "vendor-viem-wagmi",
              test: /node_modules[\\/](viem|wagmi)/,
              priority: 2,
            },
            {
              name: "vendor-react",
              test: /node_modules[\\/]react/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
});
