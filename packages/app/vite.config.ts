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
        "./src/features/chart/components/trading-chart/index.tsx",
        "./src/features/perp/pages/asset-detail.tsx",
      ],
    },
    proxy: {
      "/api": { target: "http://localhost:9006", changeOrigin: true },
    },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
});
