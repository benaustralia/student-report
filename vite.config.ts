import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Brotli compression for better compression ratios
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024, // Only compress files larger than 1KB
    }),
    // Gzip compression as fallback
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: [
      'devserver-development--nsastudentreports.netlify.app'
    ],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - MUST stay together, don't split
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          
          // Firebase - split by feature
          'firebase-auth': ['firebase/app', 'firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          'firebase-storage': ['firebase/storage'],
          
          // Google OAuth - lazy loaded
          'google-oauth': ['@react-oauth/google'],
          
          // ZIP library
          'zip-vendor': ['jszip'],
          
          // GSAP animations
          'gsap-vendor': ['gsap', '@gsap/react'],
          
          // Radix UI - group related components
          'radix-dialogs': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-alert-dialog'
          ],
          'radix-forms': [
            '@radix-ui/react-select',
            '@radix-ui/react-label',
            '@radix-ui/react-dropdown-menu'
          ],
          'radix-layout': [
            '@radix-ui/react-collapsible',
            '@radix-ui/react-tabs',
            '@radix-ui/react-scroll-area'
          ],
          
          // Icons
          'icons': ['lucide-react'],
          
          // Utilities
          'utils': ['clsx', 'tailwind-merge', 'class-variance-authority', 'vaul']
        }
      }
    },
    // Increase chunk size warning limit to 1000kb temporarily
    chunkSizeWarningLimit: 1000,
    // Use esbuild for faster builds and avoid Rollup issues
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize module preload
    modulePreload: {
      polyfill: false
    }
  },
  // Optimize dependencies to avoid Rollup issues
  optimizeDeps: {
    exclude: ['@rollup/rollup-linux-x64-gnu']
  }
})