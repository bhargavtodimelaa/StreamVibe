import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves the app under /StreamVibe/ — keep dev at /
  base: command === "build" ? "/StreamVibe/" : "/"
}));
