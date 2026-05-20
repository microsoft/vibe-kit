import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: "0.0.0.0",
    strictPort: true,
    hmr: {
      clientPort: 5174,
    },
  },
  preview: {
    port: 4174,
    host: "0.0.0.0",
  },
});
