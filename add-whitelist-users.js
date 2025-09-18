import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB5c_cGAwOcDZcn2cuwJ5q_XCwRZYi_lAY",
  authDomain: "student-reports-final.firebaseapp.com",
  projectId: "student-reports-final",
  storageBucket: "student-reports-final.firebasestorage.app",
  messagingSenderId: "1089251772494",
  appId: "1:1089251772494:web:174627cb98a111d1a41b1f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addWhitelistedUsers() {
  try {
    const whitelistedUsers = [
      {
        email: 'bahinton@gmail.com',
        displayName: 'Ben Hinton',
        addedAt: new Date().toISOString()
      },
      {
        email: 'Wenli11651@gmail.com',
        displayName: 'Wenli',
        addedAt: new Date().toISOString()
      }
    ];

    for (const user of whitelistedUsers) {
      await setDoc(doc(db, 'whitelistedUsers', user.email), user);
      console.log(`Added ${user.email} to whitelist`);
    }

    console.log('All whitelisted users added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding whitelisted users:', error);
    process.exit(1);
  }
}

addWhitelistedUsers();
