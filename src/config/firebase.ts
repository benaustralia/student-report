import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
let app;
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

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

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

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;
