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
          
          // Form libraries
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // Other utilities
          'utils-vendor': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge', 'vaul']
        }
      },
      // Externalize problematic optional dependencies
      external: (id) => {
        if (id.includes('@rollup/rollup-linux-x64-gnu')) {
          return true;
        }
        return false;
      }
    },
    // Increase chunk size warning limit to 1000kb temporarily
    chunkSizeWarningLimit: 1000
  }
})