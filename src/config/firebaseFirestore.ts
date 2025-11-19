// Lazy-loaded Firestore initialization
// This file is only imported dynamically to avoid loading Firestore on the login page

import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import app from './firebase';

// Type assertion - app is already initialized in firebase.ts
const firebaseApp = app as FirebaseApp;

// Lazy-loaded Firestore instance
let _db: Firestore | null = null;
export const getDb = async (): Promise<Firestore> => {
  if (!_db) {
    const { getFirestore } = await import('firebase/firestore');
    _db = getFirestore(firebaseApp);
  }
  return _db;
};

