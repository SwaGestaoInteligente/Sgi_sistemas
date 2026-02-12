import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "serve" ? "/" : "/Sgi_sistemas/",
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:7000"
    }
  }
}));
