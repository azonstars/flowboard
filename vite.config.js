import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'manifest.json'],
      manifest: {
        name: 'FlowBoard',
        short_name: 'FlowBoard',
        description: 'FlowBoard — ফর্ম সাবমিশন ও রিপোর্ট ম্যানেজমেন্ট সিস্টেম',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#1d4ed8',
        theme_color: '#1d4ed8',
        orientation: 'portrait-primary',
        lang: 'bn',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // App shell cache — UI দ্রুত load হবে
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Supabase API calls cache করব না
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Supabase REST API — network first, তারপর cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // ৫ মিনিট
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Static assets — cache first
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // ৩০ দিন
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
  },
})