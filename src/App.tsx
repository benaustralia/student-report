import { useState, useEffect, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './hooks/useAuthContext';
import { Toaster } from '@/components/ui/sonner';
import { RBAApp } from './components/RBAApp';
import { LoginForm } from './components/LoginForm';

// Lazy load Google OAuth - only load when user needs to sign in
const GoogleAuthWrapper = lazy(() => import('./components/GoogleAuthWrapper').then(m => ({ default: m.GoogleAuthWrapper })));

function AppContent() {
  const { user, loading, error } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // (removed) Global Image.src interceptor; now using public URLs instead

  // Global guard: rewrite fetch requests to Firebase Storage without tokens
  useEffect(() => {
    const isFirebaseStorageUrl = (url: string) =>
      /^https?:\/\//i.test(url) && url.includes('firebasestorage.googleapis.com') && !url.includes('token=') && !url.includes('alt=media');

    // Wrap fetch
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (isFirebaseStorageUrl(url)) {
          const { refreshDownloadURL } = await import('@/services/storageService');
          const fresh = await refreshDownloadURL(url);
          return originalFetch(fresh, init);
        }
      } catch {}
      return originalFetch(input as any, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Reset signing in state when user changes
  useEffect(() => {
    if (!user) {
      setIsSigningIn(false);
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
        <Suspense fallback={
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading sign-in...</span>
            </CardContent>
          </Card>
        }>
          <GoogleAuthWrapper>
            <LoginForm 
              onSignIn={handleSignIn}
              isSigningIn={isSigningIn}
              setIsSigningIn={setIsSigningIn}
            />
          </GoogleAuthWrapper>
        </Suspense>
      </div>
    );
  }

        // Render RBAApp directly
        return <RBAApp user={user} />;
}

export default function TeacherReports() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}