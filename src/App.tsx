import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './hooks/useAuthContext';

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

  // Reset signing in state when user changes
  useEffect(() => {
    if (!user) setIsSigningIn(false);
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
            error={error}
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
  // Load Toaster immediately - needed for login page toasts (password reset, etc.)
  // Sonner toasts won't display properly without the Toaster component
  const [showToaster, setShowToaster] = useState(false);
  
  useEffect(() => {
    // Load Toaster as soon as possible so login page toasts work
    // Use a short timeout to avoid blocking initial render
    setTimeout(() => {
      setShowToaster(true);
    }, 100);
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