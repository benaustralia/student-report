import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '@/config/firebase';

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

    const initAuth = () => {
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
    };

    // Defer auth initialization to reduce TBT
    // Use requestIdleCallback if available, otherwise small delay
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initAuth, { timeout: 100 });
    } else {
      // Fallback: very small delay to let initial render complete
      setTimeout(initAuth, 0);
    }

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
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
