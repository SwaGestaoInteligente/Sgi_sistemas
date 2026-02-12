import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const basePath = process.env.VITE_BASE_PATH || "/Sgi_sistemas/";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "serve" ? "/" : basePath,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:7000"
    }
  }
}));
