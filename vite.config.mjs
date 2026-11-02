import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "public",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "../dist/public",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), "public/index.html"),
        pc: path.resolve(process.cwd(), "public/pc/index.html"),
        mobile: path.resolve(process.cwd(), "public/mobile/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
      "/master": {
        target: "http://localhost:3000",
      },
      "/squares": {
        target: "http://localhost:3000",
      },
      "/pc/board.js": {
        target: "http://localhost:3000",
      },
    },
  },
});

