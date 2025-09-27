import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React and core libraries
          'react-vendor': ['react', 'react-dom'],
          
          // Firebase (large library)
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          
          // PDF and ZIP libraries (only loaded when needed)
          'pdf-vendor': ['jspdf', 'svg2pdf.js'],
          'zip-vendor': ['jszip'],
          
          // UI libraries
          'ui-vendor': [
            '@radix-ui/react-collapsible',
            '@radix-ui/react-dialog', 
            '@radix-ui/react-label',
            '@radix-ui/react-primitive',
            '@radix-ui/react-select',
            '@radix-ui/react-slot'
          ],
          
          
          // Other utilities
          'utils-vendor': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge', 'vaul']
        }
      }
    },
    // Increase chunk size warning limit to 1000kb temporarily
    chunkSizeWarningLimit: 1000,
    // Use esbuild for faster builds and avoid Rollup issues
    minify: 'esbuild',
    // Target modern browsers to avoid Rollup compatibility issues
    target: 'esnext'
  },
  // Optimize dependencies to avoid Rollup issues
  optimizeDeps: {
    exclude: ['@rollup/rollup-linux-x64-gnu']
  }
})