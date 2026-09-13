import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// Strip external Google Fonts <link> tags so the preview makes ZERO network
// requests; Tailwind's font stack falls back to system fonts offline.
function stripExternalFonts(): Plugin {
  return {
    name: "strip-external-fonts",
    transformIndexHtml(html) {
      return html.replace(/\s*<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, "");
    },
  };
}

// Produces a single, fully self-contained index.html (all JS/CSS inlined)
// used as the shareable, offline-capable preview build.
export default defineConfig({
  plugins: [react(), stripExternalFonts(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-preview",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000_000,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
