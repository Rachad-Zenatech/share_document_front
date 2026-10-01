import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_BASE_URL || "http://localhost:8006";

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    // Pin the dev server to 5176 so it matches the backend's Microsoft SSO
    // redirect target (FRONTEND_URL) and CORS_ALLOWED_ORIGINS.
    server: {
      port: 5176,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/ai": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/health": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/docs": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/openapi.json": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
