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
  console.log('Firebase initialized successfully');
  
  // Add connection state monitoring
  if (typeof window !== 'undefined') {
    // Monitor online/offline state
    window.addEventListener('online', () => {
      console.log('Network: Online');
    });
    
    window.addEventListener('offline', () => {
      console.log('Network: Offline');
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

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;
