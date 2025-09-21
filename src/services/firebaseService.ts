import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, deleteField, writeBatch } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import type { Class, Student, ReportData } from '../types';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  isWhitelisted: boolean;
}

// Generic CRUD
const createDoc = async (collectionName: string, data: any) => (await addDoc(collection(db, collectionName), { ...data, createdAt: new Date(), updatedAt: new Date() })).id;
const getDocsByQuery = async <T>(collectionName: string, conditions: [string, any, any][] = []): Promise<T[]> => {
  const q = conditions.length ? query(collection(db, collectionName), ...conditions.map(([field, op, value]) => where(field, op, value))) : collection(db, collectionName);
  return (await getDocs(q)).docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};
const updateDocById = async (collectionName: string, id: string, updates: any) => await updateDoc(doc(db, collectionName, id), { ...updates, updatedAt: new Date() });
const deleteDocById = async (collectionName: string, id: string) => await deleteDoc(doc(db, collectionName, id));

// Auth
export const signInWithGoogle = async () => (await signInWithPopup(auth, googleProvider)).user;
export const signOutUser = async () => await signOut(auth);
export const onAuthStateChange = (callback: (user: any) => void) => onAuthStateChanged(auth, callback);

// Admin
export const isUserAdmin = async (email: string): Promise<boolean> => (await getDocsByQuery('adminUsers', [['email', '==', email], ['isAdmin', '==', true]])).length > 0;

// Legacy
export const createLegacyReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => await createDoc('reports', reportData);
export const getReportsByUser = async (userId: string): Promise<ReportData[]> => {
  const reports = await getDocsByQuery<ReportData>('reports', [['userId', '==', userId]]);
  return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};
export const getAllReports = async (): Promise<ReportData[]> => {
  const reports = await getDocsByQuery<ReportData>('reports');
  return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// RBA
export const getClassesForTeacher = async (teacherEmail: string): Promise<Class[]> => {
  const classes = await getDocsByQuery<Class>('classes', [['teacherEmail', '==', teacherEmail]]);
  return classes.sort((a, b) => a.classLevel.localeCompare(b.classLevel));
};
// Removed duplicate getAllClasses definition to fix redeclaration error
export const getStudentsForClass = async (classId: string): Promise<Student[]> => {
  const students = await getDocsByQuery<Student>('students', [['classId', '==', classId]]);
  return students.sort((a, b) => a.lastName.localeCompare(b.lastName));
};
export const getReportsForStudent = async (studentId: string): Promise<ReportData[]> => {
  const reports = await getDocsByQuery<ReportData>('reports', [['studentId', '==', studentId]]);
  return reports.length > 0 ? [reports.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]] : [];
};
export const getReportsForClass = async (classId: string): Promise<ReportData[]> => {
  const reports = await getDocsByQuery<ReportData>('reports', [['classId', '==', classId]]);
  return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Reports
export const createOrUpdateReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existingReports = await getDocsByQuery<ReportData>('reports', [['studentId', '==', reportData.studentId]]);
  if (existingReports.length === 0) return await createDoc('reports', reportData);
  const existingId = existingReports[0].id;
  const updateData: any = { ...reportData, updatedAt: new Date() };
  if (!('artworkUrl' in reportData)) updateData.artworkUrl = deleteField();
  await updateDocById('reports', existingId, updateData);
  return existingId;
};
export const createReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => await createOrUpdateReport(reportData);
export const updateReport = async (reportId: string, updates: Partial<ReportData>): Promise<void> => await updateDocById('reports', reportId, updates);
export const deleteReport = async (reportId: string): Promise<void> => await deleteDocById('reports', reportId);

// Utils
export const getUserDisplayName = async (email: string): Promise<string | null> => {
  const users = await getDocsByQuery<any>('adminUsers', [['email', '==', email]]);
  return users.length > 0 ? `${users[0].firstName} ${users[0].lastName}`.trim() : null;
};
export const getAllUsers = async (): Promise<any[]> => await getDocsByQuery<any>('adminUsers').catch(() => []);
export const getAllClasses = async (): Promise<Class[]> => await getDocsByQuery<Class>('classes').catch(() => []);
export const getAllStudents = async (): Promise<Student[]> => await getDocsByQuery<Student>('students').catch(() => []);
export const getAllTeachers = async (): Promise<any[]> => await getDocsByQuery<any>('teachers').catch(() => []);
export const isUserWhitelisted = async (email: string): Promise<boolean> => (await getDocsByQuery('whitelistedUsers', [['email', '==', email]])).length > 0;

// Import
export const importUsers = async (usersData: any[]): Promise<void> => {
  usersData.forEach(user => { if (!user.email || !user.firstName || !user.lastName) throw new Error(`Invalid user data: ${JSON.stringify(user)}`); });
  
  // Separate admin users from regular teachers
  const adminUsers = usersData.filter(user => user.isAdmin === true);
  const teachers = usersData.filter(user => user.isAdmin === false || user.isAdmin === undefined);
  
  // Add admin users to adminUsers collection
  if (adminUsers.length > 0) {
    await Promise.all(adminUsers.map(user => createDoc('adminUsers', user)));
  }
  
  // Add teachers to the teachers collection
  if (teachers.length > 0) {
    await Promise.all(teachers.map(teacher => createDoc('teachers', teacher)));
  }
};
export const importClasses = async (classesData: any[]): Promise<void> => {
  const users = await getAllUsers();
  const userMap = new Map(users.map(user => [user.email, user]));
  await Promise.all(classesData.map(classData => {
    const teacher = userMap.get(classData.teacherEmail);
    if (!teacher && !classData.teacherFirstName) throw new Error(`Teacher ${classData.teacherEmail} not found`);
    return createDoc('classes', { ...classData, teacherFirstName: teacher?.firstName, teacherLastName: teacher?.lastName });
  }));
};
export const importStudents = async (studentsData: any[]): Promise<void> => {
  // If students have teacherEmail instead of classId, find the matching class
  const classes = await getAllClasses();
  await Promise.all(studentsData.map(async student => {
    let classId = student.classId;
    
    // If no classId but has teacherEmail, find matching class
    if (!classId && student.teacherEmail) {
      const matchingClass = classes.find(cls => cls.teacherEmail === student.teacherEmail);
      if (matchingClass) {
        classId = matchingClass.id;
      }
    }
    
    const studentData = {
      ...student,
      classId: classId || 'unknown',
      firstName: student.firstName,
      lastName: student.lastName
    };
    
    await createDoc('students', studentData);
  }));
};

export const importReports = async (reportsData: any[]): Promise<void> => {
  // Import reports with simplified structure (studentName + teacherEmail)
  const [students, classes] = await Promise.all([getAllStudents(), getAllClasses()]);
  
  await Promise.all(reportsData.map(async report => {
    // Find student by name
    const student = students.find(s => 
      `${s.firstName} ${s.lastName}` === report.studentName
    );
    
    // Find class by teacher email
    const classData = classes.find(c => c.teacherEmail === report.teacherEmail);
    
    const reportData = {
      ...report,
      studentId: student?.id || 'unknown',
      classId: classData?.id || 'unknown',
      teacherEmail: report.teacherEmail,
      reportText: report.reportText || report.comments
    };
    
    await createDoc('reports', reportData);
  }));
};

// Admin management
export const getAdminUserByEmail = async (email: string): Promise<any | null> => {
  const users = await getDocsByQuery<any>('adminUsers', [['email', '==', email]]);
  return users.length > 0 ? users[0] : null;
};
export const updateAdminUser = async (email: string, updateData: any): Promise<boolean> => {
  const users = await getDocsByQuery<any>('adminUsers', [['email', '==', email]]);
  if (users.length === 0) return false;
  await Promise.all(users.map(user => updateDocById('adminUsers', user.id, updateData)));
  return true;
};
export const removeAdminUserByEmail = async (email: string): Promise<boolean> => {
  const users = await getDocsByQuery<any>('adminUsers', [['email', '==', email]]);
  if (users.length === 0) return false;
  await Promise.all(users.map(user => deleteDocById('adminUsers', user.id)));
  return true;
};

// Stats
export const getUniqueTeacherCount = async (): Promise<number> => (await getAllTeachers()).length;
export const getTeacherUserCount = async (): Promise<number> => {
  const [classes, adminUsers] = await Promise.all([getAllClasses(), getAllUsers()]);
  const teacherEmails = new Set(classes.map(cls => cls.teacherEmail));
  const adminEmails = new Set(adminUsers.map(user => user.email));
  return [...teacherEmails].filter(email => !adminEmails.has(email)).length;
};
export const getTeacherByEmail = async (email: string): Promise<any | null> => await getAdminUserByEmail(email);

// Migration
export const migrateDataStructure = async (): Promise<{ classesUpdated: number; reportsUpdated: number }> => {
  const [classesSnapshot, reportsSnapshot] = await Promise.all([getDocs(collection(db, 'classes')), getDocs(collection(db, 'reports'))]);
  const classesBatch = writeBatch(db);
  const reportsBatch = writeBatch(db);
  let classesUpdated = 0, reportsUpdated = 0;
  classesSnapshot.docs.forEach(doc => { const { teacherFirstName, teacherLastName, ...normalized } = doc.data(); if (teacherFirstName || teacherLastName) { classesBatch.update(doc.ref, normalized); classesUpdated++; } });
  reportsSnapshot.docs.forEach(doc => { const { teacherFirstName, teacherLastName, studentFirstName, studentLastName, classDay, classTime, classLocation, classLevel, ...normalized } = doc.data(); if (teacherFirstName || teacherLastName || studentFirstName || studentLastName || classDay || classTime || classLocation || classLevel) { reportsBatch.update(doc.ref, normalized); reportsUpdated++; } });
  if (classesUpdated > 0) await classesBatch.commit();
  if (reportsUpdated > 0) await reportsBatch.commit();
  return { classesUpdated, reportsUpdated };
};
export const cleanupDuplicateReports = async (studentId: string): Promise<void> => {
  const reports = await getDocsByQuery<ReportData>('reports', [['studentId', '==', studentId]]);
  if (reports.length <= 1) return;
  const sorted = reports.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  await Promise.all(sorted.slice(1).map(report => deleteDocById('reports', report.id)));
};
export const removeDuplicateAdminUsers = async (): Promise<{ removed: number; kept: number }> => {
  const users = await getAllUsers();
  const usersByEmail = new Map<string, any[]>();
  users.forEach(user => { const email = user.email; if (!usersByEmail.has(email)) usersByEmail.set(email, []); usersByEmail.get(email)!.push(user); });
  let removed = 0, kept = 0;
  for (const [, userList] of usersByEmail) {
    if (userList.length > 1) { const sorted = userList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); await Promise.all(sorted.slice(1).map(user => deleteDocById('adminUsers', user.id))); removed += sorted.length - 1; kept += 1; } else { kept += 1; }
  }
  return { removed, kept };
};