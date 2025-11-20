import type { User } from 'firebase/auth';
import type { Context } from 'react';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

// Lazy context creation - only create when first accessed
// This ensures React is loaded before createContext is called
// Even if this file ends up in vendor chunk, context won't be created until used
let _AuthContext: Context<AuthContextType | undefined> | null = null;

function getAuthContext(): Context<AuthContextType | undefined> {
  if (!_AuthContext) {
    // Try to get React from various sources
    // First try global scope (if React is exposed)
    let React = (globalThis as any).React || (window as any).React;
    
    // If not in global scope, try to get it from the module system
    // This will work once react-vendor chunk has loaded
    if (!React || !React.createContext) {
      // Use a synchronous require-like approach that works in bundled code
      // The module will be available once react-vendor loads
      try {
        // @ts-ignore - dynamic require for React
        React = typeof require !== 'undefined' ? require('react') : null;
      } catch {
        // If require fails, React isn't loaded yet - throw helpful error
        throw new Error('React is not available yet. The react-vendor chunk must load before AuthContext can be used.');
      }
    }
    
    if (!React || !React.createContext) {
      throw new Error('React.createContext is not available. Make sure react-vendor chunk loads before using AuthContext.');
    }
    
    _AuthContext = React.createContext(undefined) as Context<AuthContextType | undefined>;
  }
  return _AuthContext;
}

// Export a Proxy that lazy-loads the context on first property access
// This prevents createContext from being called at module load time
export const AuthContext = new Proxy({} as Context<AuthContextType | undefined>, {
  get(_target, prop) {
    const context = getAuthContext();
    return (context as any)[prop];
  }
}) as Context<AuthContextType | undefined>;
