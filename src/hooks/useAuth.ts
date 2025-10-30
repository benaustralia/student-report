import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '@/config/firebase';

interface AuthState { user: User | null; loading: boolean; error: string | null; }

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, loading: true, error: null });

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      user => setAuthState({ user, loading: false, error: null }),
      error => {
        console.error('🔴 Firebase Auth Error:', error);
        setAuthState({ user: null, loading: false, error: error.message });
      }
    );
  }, []);

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      await firebaseSignOut(auth);
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Sign out failed' }));
    }
  };

  return { ...authState, signOut };
};
