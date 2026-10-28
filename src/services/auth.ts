// Browser side of Better Auth. Google is the only provider; the server decides the role.
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ basePath: '/api/auth' });

/** Redirects to Google; Better Auth brings the user back to `/` with a session cookie set. */
export const signInWithGoogle = () => authClient.signIn.social({ provider: 'google', callbackURL: '/' });

export const signOutUser = () => authClient.signOut();
