import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
  server: {
    host: "0.0.0.0",
    port,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port,
    allowedHosts: true,
  },
});

