import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import viteCompression from 'vite-plugin-compression'
import { execSync } from 'child_process'

// Get Git commit hash and branch name
const getGitInfo = () => {
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    return { commitHash, branch }
  } catch {
    return { commitHash: 'unknown', branch: 'unknown' }
  }
}

const { commitHash, branch } = getGitInfo()

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Inject version info as constants that can be used in the app
    __APP_VERSION__: JSON.stringify(commitHash),
    __GIT_BRANCH__: JSON.stringify(branch),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
    // Ensure React is resolved correctly across all chunks - prevents multiple React instances
    dedupe: ['react', 'react-dom']
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
        // Ensure react-vendor loads before other chunks by making it a dependency
        // This prevents "React is undefined" errors in vendor chunk
        manualChunks: (id) => {
          // CRITICAL: React and next-themes MUST be in the same chunk
          // Check for next-themes FIRST
          if (id.includes('next-themes')) {
            return 'react-vendor';
          }
          
          // Split node_modules into smaller chunks
          if (id.includes('node_modules')) {
            // React core - MUST stay together with next-themes
            const isReact = 
              id.includes('/react/') || 
              id.includes('/react-dom/') || 
              id.includes('/react/jsx-runtime') || 
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id === 'react' || 
              id === 'react-dom' ||
              id.endsWith('/react') ||
              id.endsWith('/react-dom');
            
            // Put React in react-vendor chunk (same as next-themes)
            if (isReact) {
              return 'react-vendor';
            }
            
            // Firebase - split by feature
            if (id.includes('firebase/app') || id.includes('firebase/auth')) {
              return 'firebase-auth';
            }
            if (id.includes('firebase/firestore')) {
              return 'firebase-firestore';
            }
            if (id.includes('firebase/storage')) {
              return 'firebase-storage';
            }
            
            // Google OAuth - lazy loaded
            if (id.includes('@react-oauth/google')) {
              return 'google-oauth';
            }
            
            // ZIP library
            if (id.includes('jszip')) {
              return 'zip-vendor';
            }
            
            // GSAP animations - @gsap/react needs React, put in react-vendor
            if (id.includes('@gsap/react')) {
              return 'react-vendor';
            }
            if (id.includes('gsap')) {
              return 'gsap-vendor';
            }
            
            // Radix UI - ALL Radix components need React, so put them in react-vendor
            // This ensures React is available when Radix components initialize
            if (id.includes('@radix-ui')) {
              return 'react-vendor';
            }
            
            // Icons - lucide-react needs React, put in react-vendor
            if (id.includes('lucide-react')) {
              return 'react-vendor';
            }
            
            // Utilities - split further
            if (id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils-core';
            }
            // class-variance-authority and vaul might use React - put in react-vendor to be safe
            if (id.includes('class-variance-authority') || id.includes('vaul')) {
              return 'react-vendor';
            }
            
            // Sonner (toast notifications) - lazy loaded, but needs React
            if (id.includes('sonner')) {
              return 'react-vendor';
            }
            
            // CRITICAL: Check for ANY react-* packages (except react/react-dom which are handled above)
            // This must catch react-dropzone, react-query, react-hook-form, etc.
            // The check must exclude react/ and react-dom/ paths to avoid false positives
            if (id.includes('react-') && !id.includes('/react/') && !id.includes('/react-dom/') && !id.includes('react/jsx-runtime')) {
              return 'react-vendor';
            }
            
            // All other node_modules - split by size to avoid large vendor bundle
            return 'vendor';
          }
          
          // Split source code into smaller chunks
          // CRITICAL: Put auth-core in react-vendor so React is available
          if (id.includes('src/contexts') || id.includes('src/hooks/useAuth')) {
            return 'react-vendor'; // Put auth-core in react-vendor so React is available
          }
          
          // Don't split theme-provider - it needs to stay with main code to access React properly
          // Splitting it causes module resolution issues with next-themes
        },
        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Increase chunk size warning limit to 1000kb temporarily
    chunkSizeWarningLimit: 1000,
    // Use esbuild for minification - more reliable than terser, avoids variable hoisting issues
    // Terser was causing "Cannot access variable before initialization" errors
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Minify CSS
    cssMinify: true,
    // Optimize module preload - disable automatic preloading to reduce critical path
    modulePreload: {
      polyfill: false,
      // Don't preload modules - let them load on demand
      resolveDependencies: () => []
    },
    // Enable source maps only in development
    sourcemap: false
  },
  // Optimize dependencies to avoid Rollup issues
  optimizeDeps: {
    exclude: ['@rollup/rollup-linux-x64-gnu'],
    // Force React to be a singleton to prevent multiple instances
    include: ['react', 'react-dom', 'react/jsx-runtime']
  }
})