import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Shown at the bottom of the Total screen so it's easy to tell which build
// a device is actually running (an installed PWA can serve a stale copy).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
function gitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// App name lives here, in index.html and in the manifest below — the project
// has no final name yet, so "Resale Prep" is a placeholder.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(gitHash()),
    __APP_BUILT_ON__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The whole site sits behind the login, so the manifest must be fetched with
      // the auth cookie (it's also public via staticwebapp.config.json, belt and braces).
      useCredentials: true,
      manifest: {
        name: 'Resale Prep',
        short_name: 'Resale',
        description: 'Prep items for Tradera, Blocket and Facebook Marketplace, and track what sells.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f3ed',
        theme_color: '#f6f3ed',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        // Never answer API calls or the login pages from the offline cache.
        navigateFallbackDenylist: [/^\/api\//, /^\/\.auth\//, /^\/403\.html$/],
      },
    }),
  ],
})
