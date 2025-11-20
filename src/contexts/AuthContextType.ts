// CRITICAL: This file MUST be in react-vendor chunk
// Import React directly - this file is guaranteed to be in react-vendor
// so React will be available when this module loads
import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

// Create context - React is guaranteed to be available because this file
// is in react-vendor chunk (see vite.config.ts manualChunks)
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
