import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './hooks/useAuthContext';
// Don't import storageService here - it pulls in Storage dependencies
// Import dynamically only when needed (after login)

// Lazy load ThemeProvider - only needed after login (saves ~50KB on login page)
const ThemeProvider = lazy(() => 
  import('./components/theme-provider').then(m => ({ default: m.ThemeProvider }))
);

// Lazy load ALL heavy components to reduce initial bundle size
// LoginForm includes Card, Input, Label, Button - all Radix UI components (~100KB+)
const LoginForm = lazy(() => import('./components/LoginForm').then(m => ({ default: m.LoginForm })));

// RBAApp - only load after login (saves ~340KB on login page)
const RBAApp = lazy(() => import('./components/RBAApp').then(m => ({ default: m.RBAApp })));

// Lazy load Toaster - toast() function works without it, Toaster just renders the UI
// Load only after user interaction or after login
const Toaster = lazy(() => import('@/components/ui/sonner').then(m => ({ default: m.Toaster })));

function AppContent() {
  const { user, loading, error } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // (removed) Global Image.src interceptor; now using public URLs instead

  // Global guard: rewrite fetch requests to Firebase Storage without tokens
  // Only set up after login to avoid loading Storage on login page
  useEffect(() => {
    if (!user) return; // Don't set up on login page
    
    const setupStorageInterceptor = async () => {
      const { refreshDownloadURL } = await import('@/services/storageService');
      const isFirebaseStorageUrl = (url: string) =>
        /^https?:\/\//i.test(url) && url.includes('firebasestorage.googleapis.com') && !url.includes('token=') && !url.includes('alt=media');

      // Wrap fetch
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
          if (isFirebaseStorageUrl(url)) {
            const fresh = await refreshDownloadURL(url);
            return originalFetch(fresh, init);
          }
        } catch {}
        return originalFetch(input as any, init);
      };

      return () => {
        window.fetch = originalFetch;
      };
    };
    
    const cleanup = setupStorageInterceptor();
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [user]);

  // Reset signing in state when user changes
  useEffect(() => {
    if (!user) {
      setIsSigningIn(false);
    } else {
      // Preload Firestore immediately when user is authenticated
      // This starts loading in parallel with RBAApp render, reducing waterfall delay
      import('@/services/firestoreLazy').then(({ preloadFirestore }) => {
        preloadFirestore().catch(() => {
          // Silently fail - Firestore will load when needed anyway
        });
      });
    }
  }, [user]);

  const handleSignIn = () => {
    // This will be called when authentication is successful
    setIsSigningIn(false);
  };


  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-center py-12 border rounded-lg bg-card">
          <div className="flex items-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mr-2" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="border-destructive border rounded-lg bg-card p-4 text-destructive">
          <p>Authentication Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Suspense fallback={
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <LoginForm 
            onSignIn={handleSignIn}
            isSigningIn={isSigningIn}
            setIsSigningIn={setIsSigningIn}
          />
        </Suspense>
      </div>
    );
  }

        // Render RBAApp with Suspense (lazy loaded)
        return (
          <Suspense fallback={
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
              <div className="flex items-center justify-center py-12 border rounded-lg bg-card">
                <div className="flex items-center">
                  <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  <span>Loading...</span>
                </div>
              </div>
            </div>
          }>
            <RBAApp user={user} />
          </Suspense>
        );
}

// Wrapper component that conditionally loads ThemeProvider only after login
function ThemedAppContent() {
  const { user } = useAuthContext();
  
  // Only load ThemeProvider after login - saves ~50KB on login page
  if (!user) {
    return <AppContent />;
  }
  
  return (
    <Suspense fallback={<AppContent />}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AppContent />
      </ThemeProvider>
    </Suspense>
  );
}

export default function TeacherReports() {
  // Load Toaster only after initial render to avoid blocking critical path
  const [showToaster, setShowToaster] = useState(false);
  
  useEffect(() => {
    // Load Toaster after page is interactive
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        setShowToaster(true);
      }, { timeout: 2000 });
    } else {
      setTimeout(() => setShowToaster(true), 2000);
    }
  }, []);
  
  return (
    <AuthProvider>
      <ThemedAppContent />
      {showToaster && (
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      )}
    </AuthProvider>
  );
}