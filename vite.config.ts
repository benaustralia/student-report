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
        manualChunks: (id) => {
          // Split node_modules into smaller chunks
          if (id.includes('node_modules')) {
            // React core - MUST stay together, don't split
            if (id.includes('react') || id.includes('react-dom') || id.includes('react/jsx-runtime')) {
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
            
            // Theme provider (next-themes) - separate chunk
            if (id.includes('next-themes')) {
              return 'theme-provider';
            }
            
            // Google OAuth - lazy loaded
            if (id.includes('@react-oauth/google')) {
              return 'google-oauth';
            }
            
            // ZIP library
            if (id.includes('jszip')) {
              return 'zip-vendor';
            }
            
            // GSAP animations
            if (id.includes('gsap')) {
              return 'gsap-vendor';
            }
            
            // Radix UI - group related components
            if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-alert-dialog')) {
              return 'radix-dialogs';
            }
            if (id.includes('@radix-ui/react-select') || id.includes('@radix-ui/react-label') || id.includes('@radix-ui/react-dropdown-menu')) {
              return 'radix-forms';
            }
            if (id.includes('@radix-ui/react-collapsible') || id.includes('@radix-ui/react-tabs') || id.includes('@radix-ui/react-scroll-area')) {
              return 'radix-layout';
            }
            
            // Icons
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            
            // Utilities
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority') || id.includes('vaul')) {
              return 'utils';
            }
            
            // All other node_modules
            return 'vendor';
          }
          
          // Split source code into smaller chunks
          if (id.includes('src/contexts') || id.includes('src/hooks/useAuth')) {
            return 'auth-core';
          }
          
          if (id.includes('src/components/theme-provider')) {
            return 'theme-provider-code';
          }
        },
        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Increase chunk size warning limit to 1000kb temporarily
    chunkSizeWarningLimit: 1000,
    // Use terser for better minification (smaller output than esbuild)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.trace'], // Remove debug logs
        passes: 2, // Multiple passes for better compression
      },
      format: {
        comments: false, // Remove all comments
      },
    },
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
    exclude: ['@rollup/rollup-linux-x64-gnu']
  }
})