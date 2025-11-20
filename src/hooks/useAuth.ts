import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { getAuthInstance } from '@/config/firebase';

// Lazy-load signOut - only needed after login
let firebaseSignOut: any = null;
const getSignOut = async () => {
  if (!firebaseSignOut) {
    const { signOut } = await import('firebase/auth');
    firebaseSignOut = signOut;
  }
  return firebaseSignOut;
};

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Modern Firebase v9+ authentication hook
  // Defer Firebase Auth initialization slightly to reduce TBT
  // Use requestIdleCallback to avoid blocking the main thread

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let mounted = true;

    const initAuth = async () => {
      if (!mounted) return;
      
      try {
        // Lazy load Firebase Auth - only loads when actually needed
        // This prevents auth iframe from loading on login page
        const auth = await getAuthInstance();
        const { onAuthStateChanged } = await import('firebase/auth');
        
        if (!mounted) return;
        
        unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            if (!mounted) return;
            setAuthState({
              user,
              loading: false,
              error: null,
            });
          },
          (error) => {
            if (!mounted) return;
            console.error('🔴 Firebase Auth Error:', error);
            setAuthState({
              user: null,
              loading: false,
              error: error.message,
            });
          }
        );
      } catch (error) {
        if (!mounted) return;
        console.error('🔴 Firebase Auth initialization error:', error);
        setAuthState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Auth initialization failed',
        });
      }
    };

    // Defer auth initialization until user interaction or after LCP
    // This prevents auth iframe from loading immediately and blocking LCP
    const initOnInteraction = () => {
      // Wait for LCP to complete (typically 2.5s) before initializing auth
      // This ensures auth iframe doesn't block the critical rendering path
      if ('requestIdleCallback' in window) {
        requestIdleCallback(initAuth, { timeout: 3000 });
      } else {
        setTimeout(initAuth, 3000); // Wait 3s to ensure LCP has completed
      }
    };

    // Only initialize after user interaction or after LCP completes (3 seconds)
    let initTimer = setTimeout(initOnInteraction, 3000);
    
    // Initialize on any user interaction (click, touch, keypress)
    const handleInteraction = () => {
      clearTimeout(initTimer);
      initOnInteraction();
      document.removeEventListener('click', handleInteraction, true);
      document.removeEventListener('touchstart', handleInteraction, true);
      document.removeEventListener('keydown', handleInteraction, true);
    };
    
    document.addEventListener('click', handleInteraction, true);
    document.addEventListener('touchstart', handleInteraction, true);
    document.addEventListener('keydown', handleInteraction, true);

    return () => {
      mounted = false;
      clearTimeout(initTimer);
      document.removeEventListener('click', handleInteraction, true);
      document.removeEventListener('touchstart', handleInteraction, true);
      document.removeEventListener('keydown', handleInteraction, true);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      const auth = await getAuthInstance();
      const signOutFn = await getSignOut();
      await signOutFn(auth);
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign out failed',
      }));
    }
  };

  return {
    ...authState,
    signOut,
  };
};
