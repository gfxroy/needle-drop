/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // GitHub Pages serves the build from /needle-drop/ (set via VITE_BASE in build:pages).
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
