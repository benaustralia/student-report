// Lazy-loaded Storage initialization
// This file is only imported dynamically to avoid loading Storage on the login page

import type { FirebaseStorage } from 'firebase/storage';
import type { FirebaseApp } from 'firebase/app';
import app from './firebase';

// Type assertion - app is already initialized in firebase.ts
const firebaseApp = app as FirebaseApp;

// Lazy-loaded Storage instance
let _storage: FirebaseStorage | null = null;
export const getStorageInstance = async (): Promise<FirebaseStorage> => {
  if (!_storage) {
    const { getStorage } = await import('firebase/storage');
    _storage = getStorage(firebaseApp);
  }
  return _storage;
};

