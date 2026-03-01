import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function vendorChunkName(id: string) {
  const normalizedId = id.replace(/\\/g, "/");
  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  const packagePath = normalizedId.split("/node_modules/")[1];
  const segments = packagePath.split("/");
  const packageName = segments[0].startsWith("@")
    ? `${segments[0]}/${segments[1]}`
    : segments[0];

  if (packageName === "react" || packageName === "react-dom" || packageName === "scheduler" || packageName === "wouter") {
    return "vendor-react";
  }
  if (packageName.startsWith("@radix-ui/")) {
    return "vendor-radix";
  }
  if (packageName.startsWith("@tanstack/")) {
    return "vendor-query";
  }
  if (packageName.startsWith("@supabase/")) {
    return "vendor-supabase";
  }
  if (packageName === "firebase") {
    return "vendor-firebase";
  }
  if (packageName === "framer-motion") {
    return "vendor-motion";
  }
  if (
    packageName === "react-hook-form" ||
    packageName === "@hookform/resolvers" ||
    packageName === "zod" ||
    packageName === "zod-validation-error"
  ) {
    return "vendor-forms";
  }
  if (packageName === "lucide-react") {
    return "vendor-icons";
  }
  if (packageName === "recharts" || packageName.startsWith("d3-")) {
    return "vendor-charts";
  }

  return "vendor";
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunkName(id);
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
