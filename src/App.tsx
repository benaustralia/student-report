import { useState, useEffect, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './hooks/useAuthContext';
import { LoginForm } from './components/LoginForm';
// Don't import storageService here - it pulls in Storage dependencies
// Import dynamically only when needed (after login)

// GoogleAuthWrapper is no longer needed - GoogleLoginButton handles its own loading
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
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <Card className="border-destructive">
          <CardContent className="text-destructive py-4">
            <p>Authentication Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoginForm 
          onSignIn={handleSignIn}
          isSigningIn={isSigningIn}
          setIsSigningIn={setIsSigningIn}
        />
      </div>
    );
  }

        // Render RBAApp with Suspense (lazy loaded)
        return (
          <Suspense fallback={
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Loading...</span>
                </CardContent>
              </Card>
            </div>
          }>
            <RBAApp user={user} />
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
      <AppContent />
      {showToaster && (
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      )}
    </AuthProvider>
  );
}