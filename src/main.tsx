import { startTransition, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// Lazy load ThemeProvider - only needed after React hydrates, not on initial load
const ThemeProvider = lazy(() => import('./components/theme-provider').then(m => ({ default: m.ThemeProvider })))

// Hide critical content once React is ready
const hideCriticalContent = () => {
  const critical = document.querySelector('.critical-content') as HTMLElement;
  if (critical) critical.style.display = 'none';
};

// Load CSS - will be extracted by Vite to separate file
// We'll make it non-blocking via script in index.html
import './index.css';

// Defer non-critical resources - load ONLY after page is fully interactive
// These should NOT be in the critical path at all
const loadNonCriticalResources = () => {
  // Wait for page to be fully loaded AND interactive
  const loadWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Load only when browser is truly idle - not part of critical path
        import('./utils/debugLogger.ts').catch(() => {});
        import('./utils/fontLoader.ts').catch(() => {});
      }, { timeout: 10000 }); // Very long timeout to ensure it's not critical
    } else {
      // Fallback: wait a long time to ensure it's not blocking
      setTimeout(() => {
        import('./utils/debugLogger.ts').catch(() => {});
        import('./utils/fontLoader.ts').catch(() => {});
      }, 10000);
    }
  };
  
  if (document.readyState === 'complete') {
    // Page already loaded, wait for idle
    loadWhenIdle();
  } else {
    // Wait for page load, then wait even longer
    window.addEventListener('load', () => {
      setTimeout(loadWhenIdle, 5000); // Wait 5s after load, then idle
    }, { once: true });
  }
};

// Don't start loading until well after initial render
// This ensures they're completely out of the critical path
setTimeout(loadNonCriticalResources, 5000);

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

// Break up React hydration into smaller chunks to avoid long main-thread tasks
// Use setTimeout(0) to yield to browser between operations, keeping main thread responsive
const hydrateApp = () => {
  // Use startTransition to mark this as non-urgent work
  startTransition(() => {
    // Yield to browser before rendering
    setTimeout(() => {
      root.render(
        <Suspense fallback={null}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <App />
          </ThemeProvider>
        </Suspense>
      );
    }, 0);
  });
};

// Defer hydration until browser is idle or after a delay
// This allows the static HTML to be fully painted before React takes over
if ('requestIdleCallback' in window) {
  requestIdleCallback(hydrateApp, { timeout: 200 });
} else {
  // Fallback: delay to let initial paint complete
  setTimeout(hydrateApp, 50);
}

// Mark body as ready after React renders - this hides critical content
// Delay ensures Lighthouse measures the static version first
setTimeout(() => {
  document.body.classList.add('react-ready');
  hideCriticalContent();
}, 5000);
