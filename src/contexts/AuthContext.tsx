import React from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthContext } from './AuthContextType';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

