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
        // One sw.js with the workbox runtime inside it, so the only update file
        // (public in staticwebapp.config.json) needs no login.
        inlineWorkboxRuntime: true,
        // Never answer API calls or the login pages from the offline cache.
        navigateFallbackDenylist: [/^\/api\//, /^\/\.auth\//, /^\/403\.html$/],
        // Photos never change for a given id, so keep them in the service
        // worker's cache and never ask the server again. iOS throws away the
        // browser's normal cache when it closes the home-screen app, so the
        // "immutable" header alone made every photo reload on each open.
        // Only real photos (200) are kept, never a login redirect. Small
        // thumbnails first, since a full-size URL would also match the second rule.
        runtimeCaching: [
          {
            urlPattern: /\/api\/photos\/[^/?]+\?size=thumb$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'photo-thumbs',
              expiration: { maxEntries: 3000, purgeOnQuotaError: true }, // ~10 KB each
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/api\/photos\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'photos-full',
              expiration: { maxEntries: 400, purgeOnQuotaError: true }, // ~150 KB each
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
})
