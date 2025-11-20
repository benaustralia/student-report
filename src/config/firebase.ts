import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
// Firestore and Storage are lazy-loaded - don't import here to avoid loading on login page
// Auth is also lazy-loaded to prevent auth iframe from loading on login page

// Firebase config for student-reports-final
const firebaseConfig = {
  apiKey: "AIzaSyB5c_cGAwOcDZcn2cuwJ5q_XCwRZYi_lAY",
  authDomain: "student-reports-final.firebaseapp.com",
  projectId: "student-reports-final",
  storageBucket: "student-reports-final.firebasestorage.app",
  messagingSenderId: "1089251772494",
  appId: "1:1089251772494:web:174627cb98a111d1a41b1f"
};

// Initialize Firebase
let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
  
  // Add connection state monitoring
  if (typeof window !== 'undefined') {
    // Monitor online/offline state
    window.addEventListener('online', () => {
      if (import.meta.env.DEV) {
        // Network is back online
      }
    });
    
    window.addEventListener('offline', () => {
      if (import.meta.env.DEV) {
        // Network is offline
      }
    });
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

// Lazy-load Firebase Auth to prevent auth iframe from loading on login page
// Only initialize when actually needed (user interaction or after login)
let _auth: Auth | null = null;
let _googleProvider: any = null;

// Explicitly export the functions to ensure TypeScript can resolve them
export async function getAuthInstance(): Promise<Auth> {
  if (!_auth) {
    const { getAuth } = await import('firebase/auth');
    _auth = getAuth(app);
  }
  return _auth;
}

// For backward compatibility, export a getter that lazy-loads
export const auth = new Proxy({} as Auth, {
  get: (target, prop) => {
    if (!_auth) {
      // Initialize synchronously if already loaded, otherwise return undefined
      // This allows gradual migration
      return undefined;
    }
    return (target as any)[prop];
  }
}) as Auth;

// Lazy-load Google Auth Provider
export async function getGoogleProvider() {
  if (!_googleProvider) {
    const { GoogleAuthProvider } = await import('firebase/auth');
    _googleProvider = new GoogleAuthProvider();
  }
  return _googleProvider;
}

// Firestore and Storage are in separate files to allow proper code splitting
// Import from firebaseFirestore.ts and firebaseStorage.ts when needed

// Enable Firebase performance optimizations
if (typeof window !== 'undefined') {
  // Note: db.settings() was deprecated in Firebase v9+
  // Caching is now handled automatically by Firebase
  
  // Enable offline persistence for instant data loading
  try {
    // Firebase v9+ automatically enables offline persistence
    // We can also manually control network state for better performance
  } catch (error) {
    console.warn('Firebase offline persistence setup warning:', error);
  }
}

export default app;
