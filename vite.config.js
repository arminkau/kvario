import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    watch: {
      /* android/ och ios/ innehåller kopior av dist efter cap sync.
         Utan detta laddar dev-servern om varje gång de skrivs. */
      ignored: ["**/android/**", "**/ios/**", "**/dist/**"],
    },
  },
  plugins: [
    react(),
    /* Gör webbversionen installerbar på hemskärmen och startbar utan
       webbläsarens adressfält. Samma bygge används av Capacitor-
       apparna, så ikoner och namn behöver bara underhållas här. */
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Kvario — vad av pengarna som faktiskt är dina",
        short_name: "Kvario",
        description:
          "Se direkt hur mycket av det du fakturerar som är moms, skatt och egenavgifter — och vad som faktiskt blir kvar till dig.",
        lang: "sv",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#E4EBE7",
        theme_color: "#E4EBE7",
        icons: [
          { src: "/ikon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/ikon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        /* Skalet cachas så att appen startar utan nät. Anrop till
           Supabase och betalservern ska däremot aldrig cachas — de
           måste alltid gå mot färsk data. */
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith("supabase.co") || url.hostname.endsWith("railway.app"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.hostname.includes("fonts.g"),
            handler: "CacheFirst",
            options: {
              cacheName: "typsnitt",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
