/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages gibi alt klasörde de çalışsın diye göreli yollar
  base: "./",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
