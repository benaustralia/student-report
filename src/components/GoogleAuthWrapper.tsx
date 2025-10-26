import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactNode } from 'react';

interface GoogleAuthWrapperProps {
  children: ReactNode;
}

export function GoogleAuthWrapper({ children }: GoogleAuthWrapperProps) {
  return (
    <GoogleOAuthProvider clientId="1089251772494-s8a9lafg8ju91vvaq426bkvj5mon7vm9.apps.googleusercontent.com">
      {children}
    </GoogleOAuthProvider>
  );
}

