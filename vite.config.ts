import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 5173,
    // Tauri expects a fixed port, fail if that port is not available
    strictPort: true,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // to make use of `TAURI_DEBUG` and other env variables
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri uses Chromium on Linux so no need to support older browsers
    target: "chrome105",
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: "dist",
  },
}));
