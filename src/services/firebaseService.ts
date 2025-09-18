import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch
} from 'firebase/firestore';
// Firebase Storage imports removed - using Cloudinary instead
import { auth, db, googleProvider } from '../config/firebase';
import type { Class, Student, ReportData as NewReportData } from '../types';

// Utility function to retry Firebase operations
const retryFirebaseOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isNetworkError = error instanceof Error && 
        (error.message.includes('network') || 
         error.message.includes('ERR_NETWORK_CHANGED') ||
         error.message.includes('Failed to fetch'));
      
      if (isNetworkError && attempt < maxRetries) {
        console.warn(`Firebase operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
};

// Types
export interface ReportData {
  id?: string;
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date: string;
  artworkUrl?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  isWhitelisted: boolean;
}

// Authentication
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};


export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Check if user is whitelisted
export const isUserWhitelisted = async (email: string): Promise<boolean> => {
  try {
    const usersRef = collection(db, 'whitelistedUsers');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking whitelist:', error);
    // Fallback to hardcoded list if Firestore fails
    const whitelistedEmails = ['bahinton@gmail.com', 'Wenli11651@gmail.com'];
    return whitelistedEmails.includes(email);
  }
};

// Image upload/delete functions moved to cloudinaryService.ts

// Legacy Reports CRUD operations (keeping for backward compatibility)
export const createLegacyReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'reports'), {
      ...reportData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating report:', error);
    throw error;
  }
};

export const getReportsByUser = async (userId: string): Promise<ReportData[]> => {
  try {
    console.log('firebaseService: Getting reports for userId:', userId);
    const reportsRef = collection(db, 'reports');
    const q = query(
      reportsRef, 
      where('userId', '==', userId)
    );
    console.log('firebaseService: Executing Firestore query');
    const querySnapshot = await getDocs(q);
    console.log('firebaseService: Query completed, found', querySnapshot.docs.length, 'documents');
    
    // Sort by createdAt in JavaScript since we can't use orderBy without an index
    const reports = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ReportData));
    
    console.log('firebaseService: Mapped reports:', reports.length);
    
    // Sort by createdAt descending
    const sortedReports = reports.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
      const bTime = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
    
    console.log('firebaseService: Returning', sortedReports.length, 'sorted reports');
    return sortedReports;
  } catch (error) {
    console.error('firebaseService: Error getting reports:', error);
    throw error;
  }
};


// Get all reports (for admin purposes)
export const getAllReports = async (): Promise<ReportData[]> => {
  try {
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef);
    const querySnapshot = await getDocs(q);
    
    // Sort by createdAt descending in JavaScript
    const reports = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ReportData));
    
    return reports.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
      const bTime = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  } catch (error) {
    console.error('Error getting all reports:', error);
    throw error;
  }
};

// RBA Functions

// Check if user is admin
export const isUserAdmin = async (email: string): Promise<boolean> => {
  // Development fallback for bahinton@gmail.com
  if (email === 'bahinton@gmail.com') {
    return true;
  }
  
  try {
    const adminRef = collection(db, 'adminUsers');
    const q = query(adminRef, where('email', '==', email), where('isAdmin', '==', true));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Get user display name from admin users collection
export const getUserDisplayName = async (email: string): Promise<string | null> => {
  try {
    const adminRef = collection(db, 'adminUsers');
    const q = query(adminRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      return `${userData.firstName} ${userData.lastName}`.trim();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user display name:', error);
    return null;
  }
};

// Get classes for a specific teacher
export const getClassesForTeacher = async (teacherEmail: string): Promise<Class[]> => {
  return retryFirebaseOperation(async () => {
    const classesRef = collection(db, 'classes');
    const q = query(classesRef, where('teacherEmail', '==', teacherEmail));
    const querySnapshot = await getDocs(q);
    
    const classes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Class));
    
    // Sort by classLevel in JavaScript
    return classes.sort((a, b) => a.classLevel.localeCompare(b.classLevel));
  }).catch(error => {
    console.error('Error getting classes for teacher after retries:', error);
    // If it's still a network error after retries, return empty array
    if (error instanceof Error && error.message.includes('network')) {
      console.warn('Network error detected after retries, returning empty classes array');
      return [];
    }
    throw error;
  });
};

// Get all classes (admin only)
export const getAllClasses = async (): Promise<Class[]> => {
  return retryFirebaseOperation(async () => {
    const classesRef = collection(db, 'classes');
    const q = query(classesRef);
    const querySnapshot = await getDocs(q);
    
    const classes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Class));
    
    // Sort by teacherEmail in JavaScript
    return classes.sort((a, b) => a.teacherEmail.localeCompare(b.teacherEmail));
  }).catch(error => {
    console.error('Error getting all classes after retries:', error);
    // If it's still a network error after retries, return empty array
    if (error instanceof Error && error.message.includes('network')) {
      console.warn('Network error detected after retries, returning empty classes array');
      return [];
    }
    throw error;
  });
};

// Get unique teacher count (users who have classes assigned to them)
export const getUniqueTeacherCount = async (): Promise<number> => {
  try {
    const classes = await getAllClasses();
    const uniqueTeachers = new Set(classes.map(cls => cls.teacherEmail));
    return uniqueTeachers.size;
  } catch (error) {
    console.error('Error getting unique teacher count:', error);
    return 0;
  }
};

// Get count of users who are teachers (have classes) but not necessarily admins
export const getTeacherUserCount = async (): Promise<number> => {
  try {
    const classes = await getAllClasses();
    const uniqueTeacherEmails = new Set(classes.map(cls => cls.teacherEmail));
    
    // Count how many of these teachers are NOT in the admin users collection
    const adminUsers = await getAllUsers();
    const adminEmails = new Set(adminUsers.map(user => user.email));
    
    // Teachers who are not admins
    const teacherOnlyEmails = [...uniqueTeacherEmails].filter(email => !adminEmails.has(email));
    
    return teacherOnlyEmails.length;
  } catch (error) {
    console.error('Error getting teacher user count:', error);
    return 0;
  }
};

// Get teacher information by email
export const getTeacherByEmail = async (email: string): Promise<any | null> => {
  try {
    const usersRef = collection(db, 'adminUsers');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return querySnapshot.docs[0].data();
  } catch (error) {
    console.error('Error getting teacher by email:', error);
    return null;
  }
};

export const migrateDataStructure = async (): Promise<{ classesUpdated: number; reportsUpdated: number }> => {
  try {
    console.log('🚀 Starting data structure migration...');
    
    // Step 1: Normalize classes (remove teacher names)
    console.log('📚 Normalizing classes...');
    const classesRef = collection(db, 'classes');
    const classesSnapshot = await getDocs(classesRef);
    
    const classesBatch = writeBatch(db);
    let classesUpdated = 0;

    for (const classDoc of classesSnapshot.docs) {
      const classData = classDoc.data();
      const { teacherFirstName, teacherLastName, ...normalizedData } = classData;
      
      // Only update if teacher names exist (to avoid unnecessary updates)
      if (teacherFirstName || teacherLastName) {
        classesBatch.update(classDoc.ref, normalizedData);
        classesUpdated++;
      }
    }

    if (classesUpdated > 0) {
      await classesBatch.commit();
      console.log(`✅ Normalized ${classesUpdated} classes`);
    }

    // Step 2: Normalize reports (remove redundant data)
    console.log('📝 Normalizing reports...');
    const reportsRef = collection(db, 'reports');
    const reportsSnapshot = await getDocs(reportsRef);
    
    const reportsBatch = writeBatch(db);
    let reportsUpdated = 0;

    for (const reportDoc of reportsSnapshot.docs) {
      const reportData = reportDoc.data();
      
      // Remove redundant fields
      const {
        teacherFirstName,
        teacherLastName,
        studentFirstName,
        studentLastName,
        classDay,
        classTime,
        classLocation,
        classLevel,
        ...normalizedData
      } = reportData;

      // Only update if redundant fields exist
      if (teacherFirstName || teacherLastName || studentFirstName || studentLastName || 
          classDay || classTime || classLocation || classLevel) {
        reportsBatch.update(reportDoc.ref, normalizedData);
        reportsUpdated++;
      }
    }

    if (reportsUpdated > 0) {
      await reportsBatch.commit();
      console.log(`✅ Normalized ${reportsUpdated} reports`);
    }

    console.log('🎉 Migration completed successfully!');
    return { classesUpdated, reportsUpdated };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Get students for a specific class
export const getStudentsForClass = async (classId: string): Promise<Student[]> => {
  try {
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('classId', '==', classId));
    const querySnapshot = await getDocs(q);
    
    const students = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Student));
    
    // Sort by lastName in JavaScript
    return students.sort((a, b) => a.lastName.localeCompare(b.lastName));
  } catch (error) {
    console.error('Error getting students for class:', error);
    // If it's a network error, return empty array instead of throwing
    if (error instanceof Error && error.message.includes('network')) {
      console.warn('Network error detected, returning empty students array');
      return [];
    }
    throw error;
  }
};

// Get reports for a specific student (returns only the most recent report)
export const getReportsForStudent = async (studentId: string): Promise<NewReportData[]> => {
  try {
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, where('studentId', '==', studentId));
    const querySnapshot = await getDocs(q);
    
    const reports = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as NewReportData));
    
    if (reports.length === 0) {
      return [];
    }
    
    // Sort by updatedAt descending to get the most recent
    const sortedReports = reports.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0);
      const bTime = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
    
    // Return only the most recent report (ensuring single report per student)
    return [sortedReports[0]];
  } catch (error) {
    console.error('Error getting reports for student:', error);
    // If it's a network error, return empty array instead of throwing
    if (error instanceof Error && error.message.includes('network')) {
      console.warn('Network error detected, returning empty reports array');
      return [];
    }
    throw error;
  }
};

// Get all reports for a class (for ZIP download)
export const getReportsForClass = async (classId: string): Promise<NewReportData[]> => {
  try {
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, where('classId', '==', classId));
    const querySnapshot = await getDocs(q);
    
    const reports = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as NewReportData));
    
    // Sort by createdAt descending in JavaScript
    return reports.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
      const bTime = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  } catch (error) {
    console.error('Error getting reports for class:', error);
    throw error;
  }
};

// Create or update a report for a student (ensures only one report per student)
export const createOrUpdateReport = async (reportData: Omit<NewReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    // First, check if a report already exists for this student
    const reportsRef = collection(db, 'reports');
    const q = query(
      reportsRef,
      where('studentId', '==', reportData.studentId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // No existing report, create a new one
      const docRef = await addDoc(reportsRef, {
        ...reportData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } else {
      // Report exists, update it
      const existingDoc = querySnapshot.docs[0];
      const docRef = doc(db, 'reports', existingDoc.id);
      
      // Prepare update data
      const updateData: any = {
        ...reportData,
        updatedAt: new Date()
      };
      
      // If artworkUrl is not provided, remove it from the document
      if (!('artworkUrl' in reportData)) {
        updateData.artworkUrl = deleteField();
      }
      
      await updateDoc(docRef, updateData);
      return existingDoc.id;
    }
  } catch (error) {
    console.error('Error creating or updating report:', error);
    throw error;
  }
};

// Create a new report (legacy function - now redirects to createOrUpdateReport)
export const createReport = async (reportData: Omit<NewReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  return createOrUpdateReport(reportData);
};

// Clean up duplicate reports for a student (keep only the most recent one)
export const cleanupDuplicateReports = async (studentId: string): Promise<void> => {
  try {
    const reportsRef = collection(db, 'reports');
    const q = query(
      reportsRef,
      where('studentId', '==', studentId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.docs.length > 1) {
      // Sort by updatedAt to find the most recent
      const reports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as NewReportData));
      
      const sortedReports = reports.sort((a, b) => {
        const aTime = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0);
        const bTime = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0);
        return bTime.getTime() - aTime.getTime();
      });
      
      // Keep the most recent, delete the rest
      const reportsToDelete = sortedReports.slice(1);
      for (const report of reportsToDelete) {
        await deleteDoc(doc(db, 'reports', report.id));
        console.log(`Deleted duplicate report for student ${studentId}: ${report.id}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up duplicate reports:', error);
    throw error;
  }
};

// Update a report
export const updateReport = async (reportId: string, updates: Partial<NewReportData>): Promise<void> => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      ...updates,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating report:', error);
    throw error;
  }
};

// Delete a report
export const deleteReport = async (reportId: string): Promise<void> => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    await deleteDoc(reportRef);
  } catch (error) {
    console.error('Error deleting report:', error);
    throw error;
  }
};

// ===== USER MANAGEMENT FUNCTIONS =====

// Get all admin users
export const getAllUsers = async (): Promise<any[]> => {
  try {
    const adminUsersRef = collection(db, 'adminUsers');
    const querySnapshot = await getDocs(adminUsersRef);
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return users;
  } catch (error) {
    console.error('Error getting all admin users:', error);
    // Return empty array if collection doesn't exist
    return [];
  }
};


// Get all students
export const getAllStudents = async (): Promise<Student[]> => {
  try {
    const studentsRef = collection(db, 'students');
    const querySnapshot = await getDocs(studentsRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Student));
  } catch (error) {
    console.error('Error getting all students:', error);
    // Return empty array if collection doesn't exist
    return [];
  }
};

// Import admin users from JSON
export const importUsers = async (usersData: any[]): Promise<void> => {
  try {
    console.log('importUsers: Starting import with data:', usersData);
    
    // Validate that all users have required fields
    for (const userData of usersData) {
      if (!userData.email) {
        throw new Error('All admin users must have an email address');
      }
      if (!userData.firstName) {
        throw new Error(`Admin user ${userData.email} is missing firstName`);
      }
      if (!userData.lastName) {
        throw new Error(`Admin user ${userData.email} is missing lastName`);
      }
    }
    
    const adminUsersRef = collection(db, 'adminUsers');
    console.log('importUsers: Collection reference created');

    for (const userData of usersData) {
      console.log('importUsers: Adding user:', userData);
      await addDoc(adminUsersRef, {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('importUsers: User added successfully');
    }

    console.log(`Successfully imported ${usersData.length} admin users`);
  } catch (error) {
    console.error('Error importing admin users:', error);
    throw error;
  }
};

// Import classes from JSON
export const importClasses = async (classesData: any[]): Promise<void> => {
  try {
    const classesRef = collection(db, 'classes');
    
    // Get all users to look up teacher names
    const users = await getAllUsers();
    const userMap = new Map(users.map(user => [user.email, user]));
    
    for (const classData of classesData) {
      // If teacherFirstName/teacherLastName are missing, look them up from users
      let teacherFirstName = classData.teacherFirstName;
      let teacherLastName = classData.teacherLastName;
      
      if (!teacherFirstName || !teacherLastName) {
        const teacher = userMap.get(classData.teacherEmail);
        if (teacher) {
          teacherFirstName = teacher.firstName;
          teacherLastName = teacher.lastName;
        } else {
          throw new Error(`Teacher with email ${classData.teacherEmail} not found in users collection`);
        }
      }
      
      await addDoc(classesRef, {
        ...classData,
        teacherFirstName,
        teacherLastName,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    console.log(`Successfully imported ${classesData.length} classes`);
  } catch (error) {
    console.error('Error importing classes:', error);
    throw error;
  }
};

// Import students from JSON
export const importStudents = async (studentsData: Student[]): Promise<void> => {
  try {
    const studentsRef = collection(db, 'students');
    
    for (const studentData of studentsData) {
      await addDoc(studentsRef, {
        ...studentData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    console.log(`Successfully imported ${studentsData.length} students`);
  } catch (error) {
    console.error('Error importing students:', error);
    throw error;
  }
};

// Get admin user by email (for debugging)
export const getAdminUserByEmail = async (email: string): Promise<any | null> => {
  try {
    console.log('getAdminUserByEmail: Looking for user with email:', email);
    
    const adminUsersRef = collection(db, 'adminUsers');
    const q = query(adminUsersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('getAdminUserByEmail: No user found with email:', email);
      return null;
    }
    
    const userData = querySnapshot.docs[0].data();
    console.log('getAdminUserByEmail: Found user data:', userData);
    return userData;
  } catch (error) {
    console.error('Error getting admin user by email:', error);
    throw error;
  }
};

// Update admin user data
export const updateAdminUser = async (email: string, updateData: any): Promise<boolean> => {
  try {
    console.log('updateAdminUser: Updating user with email:', email, 'data:', updateData);
    
    const adminUsersRef = collection(db, 'adminUsers');
    const q = query(adminUsersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('updateAdminUser: No user found with email:', email);
      return false;
    }
    
    // Update each document with this email
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        ...updateData,
        updatedAt: new Date()
      })
    );
    
    await Promise.all(updatePromises);
    console.log(`updateAdminUser: Updated ${querySnapshot.docs.length} user(s) with email:`, email);
    return true;
  } catch (error) {
    console.error('Error updating admin user:', error);
    throw error;
  }
};

// Remove admin user by email
export const removeAdminUserByEmail = async (email: string): Promise<boolean> => {
  try {
    console.log('removeAdminUserByEmail: Removing user with email:', email);
    
    // Get all admin users
    const adminUsersRef = collection(db, 'adminUsers');
    const q = query(adminUsersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('removeAdminUserByEmail: No user found with email:', email);
      return false;
    }
    
    // Delete all users with this email
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`removeAdminUserByEmail: Removed ${querySnapshot.docs.length} user(s) with email:`, email);
    return true;
  } catch (error) {
    console.error('Error removing admin user by email:', error);
    throw error;
  }
};

// Remove duplicate admin users (keeps the most recent one for each email)
export const removeDuplicateAdminUsers = async (): Promise<{ removed: number; kept: number }> => {
  try {
    console.log('removeDuplicateAdminUsers: Starting duplicate removal');
    
    // Get all admin users
    const adminUsersRef = collection(db, 'adminUsers');
    const querySnapshot = await getDocs(adminUsersRef);
    
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));
    
    console.log('removeDuplicateAdminUsers: Found users:', users);
    
    // Group by email
    const usersByEmail = new Map<string, any[]>();
    users.forEach(user => {
      const email = user.email;
      if (!usersByEmail.has(email)) {
        usersByEmail.set(email, []);
      }
      usersByEmail.get(email)!.push(user);
    });
    
    console.log('removeDuplicateAdminUsers: Grouped by email:', usersByEmail);
    
    let removedCount = 0;
    let keptCount = 0;
    
    // For each email, keep the most recent user and delete the rest
    for (const [email, userList] of usersByEmail) {
      if (userList.length > 1) {
        console.log(`removeDuplicateAdminUsers: Found ${userList.length} duplicates for ${email}`);
        
        // Sort by createdAt (most recent first)
        const sortedUsers = userList.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return bTime.getTime() - aTime.getTime();
        });
        
        // Keep the first (most recent), delete the rest
        const toKeep = sortedUsers[0];
        const toDelete = sortedUsers.slice(1);
        
        console.log(`removeDuplicateAdminUsers: Keeping user ${toKeep.id}, deleting ${toDelete.length} duplicates`);
        
        // Delete the duplicates
        const deletePromises = toDelete.map(user => deleteDoc(doc(db, 'adminUsers', user.id)));
        await Promise.all(deletePromises);
        
        keptCount += 1;
        removedCount += toDelete.length;
      } else {
        keptCount += 1;
      }
    }
    
    console.log(`removeDuplicateAdminUsers: Removed ${removedCount} duplicates, kept ${keptCount} users`);
    return { removed: removedCount, kept: keptCount };
  } catch (error) {
    console.error('Error removing duplicate admin users:', error);
    throw error;
  }
};
