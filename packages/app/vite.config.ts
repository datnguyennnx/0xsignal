import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
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
        "./src/features/chart/trading-chart/index.tsx",
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
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("lightweight-charts")) return "vendor-lightweight-charts";
          if (id.includes("node_modules/viem") || id.includes("node_modules/wagmi"))
            return "vendor-viem-wagmi";
          if (id.includes("node_modules/react")) return "vendor-react";
        },
      },
    },
  },
});
