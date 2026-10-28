import { useCallback, useEffect, useState } from 'react';
import type { User } from '@/types';
import { authClient, signOutUser } from '@/services/auth';
import { clearMeCache, getMe } from '@/services/api';

interface AuthState { user: User | null; loading: boolean; error: string | null }

/**
 * Session → app user. Better Auth tells us who signed in with Google; /api/me tells us
 * whether that account is a registered teacher or admin. Unregistered accounts are signed
 * straight back out with a message, which is what the old whitelist did.
 */
export const useAuth = () => {
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  useEffect(() => {
    if (isPending) return;
    if (!session) { clearMeCache(); setState({ user: null, loading: false, error: sessionError?.message ?? null }); return; }
    let cancelled = false;
    clearMeCache();
    getMe().then(async me => {
      if (cancelled) return;
      if (!me || me.role === 'none') {
        await signOutUser();
        setState({ user: null, loading: false, error: `${session.user.email} is not registered as a teacher or admin. Ask an administrator to add you.` });
        return;
      }
      setState({ user: me, loading: false, error: null });
    }).catch(err => {
      if (!cancelled) setState({ user: null, loading: false, error: err instanceof Error ? err.message : 'Could not load your account' });
    });
    return () => { cancelled = true; };
  }, [session, isPending, sessionError]);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try { await signOutUser(); }
    catch (error) { setState(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Sign out failed' })); }
  }, []);

  return { ...state, signOut };
};
