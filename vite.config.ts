import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // Offline-first shell: precache the hashed build assets so the app opens
    // without a network. Data freshness is the store layer's job — the
    // Supabase API is cross-origin and deliberately NOT cached here.
    // registerType 'prompt' → we surface a "New version available · Update"
    // toast instead of silently swapping code mid-session.
    VitePWA({
      registerType: 'prompt',
      // public/manifest.webmanifest is hand-maintained; don't generate one.
      manifest: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'brand.png', 'yft.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  // Absolute base: relative './' breaks nested routes (/join/:code,
  // /list/:id) — assets resolve under the route path and the SPA
  // fallback serves index.html as the "script" (MIME error).
  // Capacitor serves from the webview server root, so '/' works there too.
  base: '/',
})
