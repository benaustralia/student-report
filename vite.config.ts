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
        manualChunks(id) {
          // React core - critical, load first
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          
          // Firebase - split by feature for better tree-shaking
          if (id.includes('firebase/app') || id.includes('firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('firebase/storage')) {
            return 'firebase-storage';
          }
          
          // Google OAuth - defer until login
          if (id.includes('@react-oauth/google')) {
            return 'google-oauth';
          }
          
          // ZIP - only for bulk operations
          if (id.includes('jszip')) {
            return 'zip-vendor';
          }
          
          // GSAP - only for animations
          if (id.includes('gsap')) {
            return 'gsap-vendor';
          }
          
          // OpenAI - only for AI features
          if (id.includes('openai')) {
            return 'openai-vendor';
          }
          
          // Radix UI - split by component for aggressive tree-shaking
          if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-alert-dialog')) {
            return 'radix-dialog';
          }
          if (id.includes('@radix-ui/react-select') || id.includes('@radix-ui/react-dropdown-menu')) {
            return 'radix-select';
          }
          if (id.includes('@radix-ui/react-collapsible') || id.includes('@radix-ui/react-accordion')) {
            return 'radix-collapsible';
          }
          if (id.includes('@radix-ui/react-tabs')) {
            return 'radix-tabs';
          }
          if (id.includes('@radix-ui')) {
            return 'radix-core';
          }
          
          // Lucide icons - separate chunk
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          
          // Utilities - keep small utilities together
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'utils';
          }
          
          // All other node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
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