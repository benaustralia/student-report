import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthContext } from './AuthContextType';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={useAuth()}>
    {children}
  </AuthContext.Provider>
);

