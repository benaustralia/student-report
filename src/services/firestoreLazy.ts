// Lazy-loading wrapper for Firebase Firestore
// This prevents bundling 92% unused Firestore code on initial load
// Only loads Firestore when data operations are actually needed

// Dynamically import Firestore to avoid loading on login page

let firestoreModule: any = null;
let firestoreDb: any = null;

// Preload promise - starts loading Firestore immediately when module is imported
let preloadPromise: Promise<any> | null = null;

const startPreload = () => {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      import('firebase/firestore'),
      import('../config/firebaseFirestore').then(m => m.getDb())
    ]).then(([module, db]) => {
      firestoreModule = module;
      firestoreDb = db;
      return { module, db };
    });
  }
  return preloadPromise;
};

// Lazy load Firestore module and get db instance
const ensureFirestore = async () => {
  if (!firestoreModule) {
    // If preload is already in progress, wait for it
    if (preloadPromise) {
      await preloadPromise;
    } else {
      // Otherwise start loading now
      firestoreModule = await import('firebase/firestore');
      const { getDb } = await import('../config/firebaseFirestore');
      firestoreDb = await getDb();
    }
  }
  return {
    // Firestore functions
    collection: firestoreModule.collection,
    addDoc: firestoreModule.addDoc,
    getDocs: firestoreModule.getDocs,
    query: firestoreModule.query,
    where: firestoreModule.where,
    doc: firestoreModule.doc,
    updateDoc: firestoreModule.updateDoc,
    deleteDoc: firestoreModule.deleteDoc,
    writeBatch: firestoreModule.writeBatch,
    setDoc: firestoreModule.setDoc,
    // DB instance
    db: firestoreDb
  };
};

// Export preload function for components to call early
export const preloadFirestore = startPreload;

export default ensureFirestore;

