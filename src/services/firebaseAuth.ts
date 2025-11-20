// Firebase Auth-only functions - NO Firestore imports
// This file is safe to import on the login page without loading Firestore
// All Firebase Auth imports are lazy-loaded to prevent auth iframe from loading immediately

import { getAuthInstance, getGoogleProvider } from '../config/firebase';

// Lazy-load popup sign-in (fallback, rarely used since we use credential-based)
let signInWithPopupFn: any = null;
const getSignInWithPopup = async () => {
  if (!signInWithPopupFn) {
    const { signInWithPopup } = await import('firebase/auth');
    signInWithPopupFn = signInWithPopup;
  }
  return signInWithPopupFn;
};

// Lazy-load signOut and onAuthStateChanged (only needed after login)
let signOutFn: any = null;
let onAuthStateChangedFn: any = null;
const getAuthUtils = async () => {
  if (!signOutFn || !onAuthStateChangedFn) {
    const { signOut, onAuthStateChanged } = await import('firebase/auth');
    signOutFn = signOut;
    onAuthStateChangedFn = onAuthStateChanged;
  }
  return { signOut: signOutFn, onAuthStateChanged: onAuthStateChangedFn };
};

// Ultra-compact auth functions with composition + function merging
export const signInWithGoogle = async (credential?: string) => {
  // Lazy-load Firebase Auth only when needed
  const { signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');
  const auth = await getAuthInstance();
  const googleProvider = await getGoogleProvider();
  
  if (credential) {
    // Primary method: credential-based (used by GoogleLoginButton)
    const result = await signInWithCredential(auth, GoogleAuthProvider.credential(credential));
    return result.user;
  } else {
    // Fallback: popup method (lazy-loaded, rarely used)
    const signInWithPopup = await getSignInWithPopup();
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }
};

// Lazy-loaded auth utilities (only needed after login)
export const signOutUser = async () => {
  const { signOut } = await getAuthUtils();
  const auth = await getAuthInstance();
  return signOut(auth);
};

// onAuthStateChange is used by useAuth hook which loads on login page
// Defer initialization to prevent auth iframe from loading immediately
export const onAuthStateChange = async (callback: (user: unknown) => void) => {
  // Lazy-load Firebase Auth only when needed
  const { onAuthStateChanged } = await import('firebase/auth');
  const auth = await getAuthInstance();
  return onAuthStateChanged(auth, callback);
};

// Email/Password Authentication Functions
export const signInWithEmail = async (email: string, password: string) => {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const auth = await getAuthInstance();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const resetPassword = async (email: string) => {
  const { sendPasswordResetEmail } = await import('firebase/auth');
  const auth = await getAuthInstance();
  await sendPasswordResetEmail(auth, email);
};

