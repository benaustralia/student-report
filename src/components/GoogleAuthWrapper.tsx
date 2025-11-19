import type { ReactNode } from 'react';

interface GoogleAuthWrapperProps {
  children: ReactNode;
}

// Don't load Google OAuth provider until user actually needs it
// The children (LoginForm) will handle loading the provider when button is clicked
export function GoogleAuthWrapper({ children }: GoogleAuthWrapperProps) {
  // Just render children - the GoogleLoginButton will handle loading the provider
  return <>{children}</>;
}

