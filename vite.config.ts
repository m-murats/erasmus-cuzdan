/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Telefona kurulabilir uygulama (PWA): manifest, simgeler, çevrimdışı çalışma.
    // registerType "prompt": yeni sürüm çıkınca sayfa kendiliğinden yenilenmez, kullanıcıya sorulur (yarım form kaybolmasın).
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "./",
        name: "Erasmus Cüzdanım",
        short_name: "Cüzdanım",
        description: "Erasmus öğrencileri için harcama ve bütçe uygulaması. Verilerin yalnızca senin telefonunda kalır.",
        lang: "tr",
        start_url: "./#ana",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F2F3F7",
        theme_color: "#2350F5",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Uygulamanın tüm dosyaları (yazı tipleri dahil) önbelleğe alınır → internetsiz açılır
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // GitHub Pages gibi alt klasörde de çalışsın diye göreli yollar
  base: "./",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
