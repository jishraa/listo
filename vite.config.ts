import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Absolute base: relative './' breaks nested routes (/join/:code,
  // /list/:id) — assets resolve under the route path and the SPA
  // fallback serves index.html as the "script" (MIME error).
  // Capacitor serves from the webview server root, so '/' works there too.
  base: '/',
})
