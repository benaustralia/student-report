import { signInWithPopup, signInWithCredential, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import type { Class, Student, ReportData, Teacher, AdminUser, LegacyReportData, Request } from '../types';

export interface UserData { uid: string; email: string; displayName: string; isWhitelisted: boolean; }

// 2025 ULTIMATE: Maximum Code Compression + Function Merging + Monadic Composition
type Maybe<T> = { map: <U>(f: (x: T) => U) => Maybe<U>; flatMap: <U>(f: (x: T) => Maybe<U>) => Maybe<U>; getOrElse: <U>(defaultVal: U) => T | U };
const Maybe = <T>(value: T | null | undefined): Maybe<T> => ({
  map: <U>(f: (x: T) => U) => value != null ? Maybe(f(value)) : Maybe<U>(null as any),
  flatMap: <U>(f: (x: T) => Maybe<U>) => value != null ? f(value) : Maybe<U>(null as any),
  getOrElse: <U>(defaultVal: U) => value != null ? value : defaultVal
});

// Ultra-compact Curry + Partial Application + Function Merging
const curry = <T extends (...args: any[]) => any>(fn: T) => 
  (...args: any[]) => args.length >= fn.length ? fn(...args) : (...more: any[]) => curry(fn)(...args, ...more);

// Ultra-compact Pipe + Composition + Function Merging (unused but available)
// const pipe = <T>(...fns: Array<(arg: T) => T>) => (value: T) => fns.reduce((acc, fn) => fn(acc), value);

// Ultra-compact CRUD factory with function merging
const crud = <T>(collectionName: string) => ({
  create: curry((data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => createDoc(collectionName, data)),
  getAll: () => getDocsByQuery<T>(collectionName).catch(() => []),
  update: curry((id: string, updates: Partial<T>) => updateDocById(collectionName, id, updates)),
  delete: curry((id: string) => deleteDocById(collectionName, id)),
  getBy: curry((field: string, value: unknown) => getDocsByQuery<T>(collectionName, [[field, '==', value]]))
});

// Ultra-compact collection factories with destructuring + function merging
const [reports, classes, students, users, teachers] = 
  ['reports', 'classes', 'students', 'adminUsers', 'teachers'].map(name => crud<any>(name));

// Ultra-compact document operations with monadic error handling + function merging
const createDoc = async (collectionName: string, data: Record<string, unknown>, customId?: string) => {
  const docData = { ...data, createdAt: new Date(), updatedAt: new Date() };
  return customId ? (await setDoc(doc(db, collectionName, customId), docData), customId) :
    (await addDoc(collection(db, collectionName), docData)).id;
};

// Ultra-compact cache management with composition + function merging
const [queryCache, prefetchCache, adminCache, displayNameCache] = [new Map(), new Map(), new Map(), new Map()];
const [PREFETCH_CACHE_TTL, ADMIN_CACHE_TTL, DISPLAY_NAME_CACHE_TTL] = [2 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000];

// Ultra-compact prefetch with parallel composition + function merging
export const prefetchCriticalData = async () => {
  
  try {
    const collections = ['adminUsers', 'classes', 'teachers', 'students', 'reports'];
    const results = await Promise.all(collections.map(name => getDocsByQuery(name, [])));
    
    collections.forEach((name, i) => 
      prefetchCache.set(name, { data: results[i], timestamp: Date.now() })
    );
  } catch (error) {
    console.error('Background prefetch failed:', error);
  }
};

// Ultra-compact query with monadic error handling + function merging
const getDocsByQuery = async <T>(collectionName: string, conditions: any[] = []): Promise<T[]> => {
  const queryKey = `${collectionName}_${JSON.stringify(conditions)}`;
  const queryId = `${collectionName}_${Date.now()}`;
  
  // Prefetch cache check with monadic composition
  if (conditions.length === 0) {
    const prefetched = prefetchCache.get(collectionName);
    if (prefetched && Date.now() - prefetched.timestamp < PREFETCH_CACHE_TTL) {
      return prefetched.data as T[];
    }
  }
  
  // Deduplication check
  if (queryCache.has(queryKey)) {
    return queryCache.get(queryKey);
  }
  
  
  const queryPromise = (async () => {
    try {
      const q = conditions.length ? 
        query(collection(db, collectionName), ...conditions.map(([field, op, value]) => where(field, op, value))) : 
        collection(db, collectionName);
      const snapshot = await getDocs(q);
      
      const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
      
<<<<<<< HEAD
=======
      // Detailed logging for classes collection
      if (collectionName === 'classes') {
        console.log('📚 FIREBASE QUERY DETAILED RESULTS:', {
          collectionName,
          conditions,
          docCount: snapshot.docs.length,
          queryType: conditions.length > 0 ? 'filtered' : 'all',
          results: results.map(r => ({
            id: (r as any).id,
            teacherEmail: (r as any).teacherEmail,
            teacherEmailLength: (r as any).teacherEmail?.length,
            teacherEmailCharCodes: (r as any).teacherEmail?.split('').map((c: string) => c.charCodeAt(0)),
            teacherEmailBytes: new TextEncoder().encode((r as any).teacherEmail || ''),
            classLevel: (r as any).classLevel,
            classDay: (r as any).classDay,
            classTime: (r as any).classTime,
            createdAt: (r as any).createdAt,
            updatedAt: (r as any).updatedAt
          })),
          timestamp: new Date().toISOString()
        });
      }
      
>>>>>>> development
      return results;
    } catch (error: any) {
      console.error(`Firebase Query Error: ${queryId}`, { collection: collectionName, error: error.message });
      
      if (error?.code === 'unavailable' || error?.message?.includes('network')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const q = conditions.length ? 
            query(collection(db, collectionName), ...conditions.map(([field, op, value]) => where(field, op, value))) : 
            collection(db, collectionName);
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
        } catch (retryError) {
          console.error(`Failed to fetch ${collectionName} after retry:`, retryError);
          return [];
        }
      }
      return [];
    } finally {
      queryCache.delete(queryKey);
    }
  })();
  
  queryCache.set(queryKey, queryPromise);
  return queryPromise;
};

// Ultra-compact update/delete with retry composition + function merging
const withRetry = <T extends (...args: any[]) => Promise<any>>(fn: T) => 
  async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error: any) {
      if (error?.code === 'unavailable' || error?.message?.includes('network')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await fn(...args);
      }
      throw error;
    }
  };

const updateDocById = withRetry(async (collectionName: string, id: string, updates: Record<string, unknown>) => 
  updateDoc(doc(db, collectionName, id), { ...updates, updatedAt: new Date() })
);

const deleteDocById = withRetry(async (collectionName: string, id: string) => 
  deleteDoc(doc(db, collectionName, id))
);

// Ultra-compact auth functions with composition + function merging
export const signInWithGoogle = async (credential?: string) => {
  
  const result = credential ? 
    await signInWithCredential(auth, GoogleAuthProvider.credential(credential)) :
    await signInWithPopup(auth, googleProvider);
  
  return result.user;
};

export const signOutUser = () => signOut(auth);
export const onAuthStateChange = (callback: (user: unknown) => void) => onAuthStateChanged(auth, callback);

// Ultra-compact admin check with monadic composition + function merging
export const isUserAdmin = async (email: string): Promise<boolean> => {
  const cached = adminCache.get(email);
  if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL) {
    return cached.isAdmin;
  }
  
  const adminUsers = await getDocsByQuery('adminUsers', [['email', '==', email], ['isAdmin', '==', true]]);
  
<<<<<<< HEAD
=======
  console.log('🔍 ADMIN CHECK FIREBASE RESULTS:', {
    email,
    adminUsersFound: adminUsers.length,
    adminUsers: adminUsers.map((user: any) => ({
      id: user.id,
      email: (user as any).email,
      emailLength: (user as any).email?.length,
      emailCharCodes: (user as any).email?.split('').map((c: string) => c.charCodeAt(0)),
      emailBytes: new TextEncoder().encode((user as any).email || ''),
      isAdmin: (user as any).isAdmin
    })),
    timestamp: new Date().toISOString()
  });
  
>>>>>>> development
  const result = adminUsers.length > 0;
  
  adminCache.set(email, { isAdmin: result, timestamp: Date.now() });
  
  return result;
};

// Ultra-compact display name lookup with monadic composition + function merging
export const getUserDisplayName = async (email: string): Promise<string | null> => {
  
  const cached = displayNameCache.get(email);
  if (cached && Date.now() - cached.timestamp < DISPLAY_NAME_CACHE_TTL) {
    return cached.displayName;
  }
  
  const [adminUsers, teachers] = await Promise.all([
    getDocsByQuery<AdminUser>('adminUsers', [['email', '==', email]]),
    getDocsByQuery<Teacher>('teachers', [['email', '==', email]])
  ]);
  
  const displayName = adminUsers.length > 0 ? 
    `${adminUsers[0].firstName} ${adminUsers[0].lastName}`.trim() :
    teachers.length > 0 ? `${teachers[0].firstName} ${teachers[0].lastName}`.trim() : null;
  
  displayNameCache.set(email, { displayName, timestamp: Date.now() });
  return displayName;
};

// Ultra-compact exports using composition + function merging
export const createLegacyReport = reports.create;
export const getReportsByUser = (userId: string) => 
  getDocsByQuery<ReportData>('reports', [['userId', '==', userId]])
    .then(reports => reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
export const getAllReports = () => 
  getDocsByQuery<ReportData>('reports')
    .then(reports => reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
export const getClassesForTeacher = (teacherEmail: string) => 
  getDocsByQuery<Class>('classes', [['teacherEmail', '==', teacherEmail]])
    .then(classes => classes.sort((a, b) => a.classLevel.localeCompare(b.classLevel)));
export const getStudentsForClass = (classId: string) => 
  getDocsByQuery<Student>('students', [['classId', '==', classId]])
    .then(students => students.sort((a, b) => a.lastName.localeCompare(b.lastName)));

// Ultra-compact student counts with function merging
export const getStudentCountsForClasses = async (classIds: string[]): Promise<Record<string, number>> => {
  if (classIds.length === 0) return {};
  
  const students = await getDocsByQuery<Student>('students', [['classId', 'in', classIds]]);
  const counts = Object.fromEntries(classIds.map(id => [id, 0]));
  students.forEach(student => counts[student.classId] !== undefined && counts[student.classId]++);
  
  return counts;
};

export const getReportsForStudent = async (studentId: string): Promise<ReportData[]> => 
  getDocsByQuery<ReportData>('reports', [['studentId', '==', studentId]])
    .then(reports => reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

export const getReportsForClass = (classId: string) => 
  getDocsByQuery<ReportData>('reports', [['classId', '==', classId]])
    .then(reports => reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

export const getIncompleteReports = async (): Promise<ReportData[]> => 
  getDocsByQuery<ReportData>('reports')
    .then(reports => reports.filter(report => !report.studentName || !report.reportText));

export const cleanReportsWithoutStudentNames = async (): Promise<void> => {
  const reports = await getDocsByQuery<ReportData>('reports');
  const reportsToDelete = reports.filter(report => !report.studentName);
  
  if (reportsToDelete.length > 0) {
    const batch = writeBatch(db);
    reportsToDelete.forEach(report => batch.delete(doc(db, 'reports', report.id)));
    await batch.commit();
  }
};

// Ultra-compact report operations with monadic composition + function merging
export const createOrUpdateReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existingReport = await reports.getBy('studentId', reportData.studentId);
  return existingReport.length > 0 ? 
    (await reports.update(existingReport[0].id, reportData), existingReport[0].id) : 
    reports.create(reportData);
};

export const createReport = reports.create;
export const updateReport = reports.update;
export const deleteReport = reports.delete;

// Ultra-compact getAll functions + function merging
export const getAllUsers = users.getAll;
export const getAllStudents = students.getAll;
export const getAllClasses = classes.getAll;
export const getAllTeachers = teachers.getAll;

// Ultra-compact import functions with batch composition + function merging
const batchImport = <T>(collectionName: string, data: T[]) => {
  const batch = writeBatch(db);
  data.forEach(item => {
    const docRef = doc(collection(db, collectionName));
    batch.set(docRef, { ...item, createdAt: new Date(), updatedAt: new Date() });
  });
  return batch.commit();
};

export const importUsers = (usersData: AdminUser[]) => batchImport('adminUsers', usersData);
export const importClasses = (classesData: Class[]) => batchImport('classes', classesData);
export const importStudents = (studentsData: Student[]) => batchImport('students', studentsData);
export const importTeachers = (teachersData: Teacher[]) => batchImport('teachers', teachersData);

// Ultra-compact update/delete functions + function merging
export const updateUser = users.update;
export const updateClass = classes.update;
export const updateStudent = students.update;
export const updateTeacher = teachers.update;
export const deleteUser = users.delete;
export const deleteClass = classes.delete;
export const deleteStudent = students.delete;
export const deleteTeacher = teachers.delete;

// Ultra-compact request functions with composition + function merging
export const createRequest = async (requestData: Omit<Request, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  return await createDoc('requests', requestData);
};

export const getAllRequests = () => getDocsByQuery<Request>('requests').catch(() => []);
export const getRequestsForTeacher = (teacherEmail: string) => getDocsByQuery<Request>('requests', [['teacherEmail', '==', teacherEmail]]);
export const getPendingRequests = () => getDocsByQuery<Request>('requests', [['status', '==', 'pending']]);
export const updateRequest = (requestId: string, updates: Partial<Request>) => updateDocById('requests', requestId, updates);
export const deleteRequest = (requestId: string) => deleteDocById('requests', requestId);

export const approveRequest = async (requestId: string, adminEmail: string): Promise<void> => {
  const requests = await getDocsByQuery<Request>('requests', []);
  const request = requests.find(r => r.id === requestId);
  
  if (!request) {
    throw new Error('Request not found');
  }

  if (request.type === 'add_student' && request.studentFirstName && request.studentLastName) {
    // Create new student
    const studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
      firstName: request.studentFirstName,
      lastName: request.studentLastName,
      classId: request.classId
    };
    const studentId = `${request.studentFirstName}-${request.studentLastName}-${request.classId.split('-')[0] || 'unknown'}`;
    await createDoc('students', studentData, studentId);
  } else if (request.type === 'remove_student' && request.studentId) {
    // Delete the student completely from the database
    await deleteStudent(request.studentId);
  }

  // Update request status
  await updateDocById('requests', requestId, { 
    status: 'approved', 
    approvedBy: adminEmail, 
    approvedAt: new Date() 
  });
};

export const declineRequest = async (requestId: string, adminEmail: string): Promise<void> => 
  updateDocById('requests', requestId, { status: 'declined', declinedBy: adminEmail, declinedAt: new Date() });

export const importRequests = async (requestsData: Request[]): Promise<void> => {
  const batch = writeBatch(db);
  requestsData.forEach(request => {
    const docRef = doc(collection(db, 'requests'));
    batch.set(docRef, request as unknown as Record<string, unknown>);
  });
  await batch.commit();
};

// Ultra-compact utility functions + function merging
export const getOrphanedStudents = () => getDocsByQuery<Student>('students', [['classId', '==', '']]);
export const cleanupOrphanedStudents = async (): Promise<{ deleted: number; students: Student[] }> => {
  const orphanedStudents = await getOrphanedStudents();
  if (orphanedStudents.length === 0) return { deleted: 0, students: [] };
  
  const batch = writeBatch(db);
  orphanedStudents.forEach(student => batch.delete(doc(db, 'students', student.id)));
  await batch.commit();
  
  return { deleted: orphanedStudents.length, students: orphanedStudents };
};

export const importReports = async (reportsData: LegacyReportData[]): Promise<void> => {
  const batch = writeBatch(db);
  reportsData.forEach(report => {
    const docRef = doc(collection(db, 'reports'));
    batch.set(docRef, { ...report, createdAt: new Date(), updatedAt: new Date() });
  });
  await batch.commit();
};

// Ultra-compact admin functions with monadic composition + function merging
export const getAdminUserByEmail = (email: string) => users.getBy('email', email).then((users: any) => users[0] || null);
export const updateAdminUser = async (email: string, updateData: Partial<AdminUser>): Promise<boolean> => {
  const user = await getAdminUserByEmail(email);
  return user ? (await users.update(user.id, updateData), true) : false;
};
export const removeAdminUserByEmail = async (email: string): Promise<boolean> => {
  const user = await getAdminUserByEmail(email);
  return user ? (await users.delete(user.id), true) : false;
};

export const getUniqueTeacherCount = () => getAllTeachers().then(teachers => teachers.length);
export const getTeacherUserCount = () => getAllTeachers().then(teachers => teachers.length);
export const getTeacherByEmail = (email: string) => teachers.getBy('email', email).then((teachers: any) => teachers[0] || null);

// Ultra-compact teacher stats + function merging
export const getTeacherReportCounts = async (): Promise<Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>> => {
  const [teachers, classes, students, reports] = await Promise.all([
    getAllTeachers(), getAllClasses(), getAllStudents(), getAllReports()
  ]);
  
  return Object.fromEntries(teachers.map(teacher => {
    const teacherClasses = classes.filter(c => c.teacherEmail === teacher.email);
    const teacherStudents = students.filter(s => teacherClasses.some(c => c.id === s.classId));
    const teacherReports = reports.filter(r => teacherClasses.some(c => c.id === r.classId));
    
    return [teacher.email, {
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
      teacherEmail: teacher.email,
      reportCount: teacherReports.length,
      studentCount: teacherStudents.length
    }];
  }));
};

// Ultra-compact migration + function merging
export const migrateDataStructure = async (): Promise<{ classesUpdated: number; reportsUpdated: number }> => {
  const [classesData, reportsData] = await Promise.all([getAllClasses(), getAllReports()]);
  
  const classesUpdated = await Promise.all(classesData.map(async classData => {
    if (!classData.classLevel || !classData.classDay || !classData.classTime) {
      await classes.update(classData.id, {
        classLevel: classData.classLevel || 'Unknown',
        classDay: classData.classDay || 'Unknown',
        classTime: classData.classTime || 'Unknown'
      });
      return 1;
    }
    return 0;
  })).then(results => results.reduce((a: number, b: number) => a + b, 0));
  
  const reportsUpdated = await Promise.all(reportsData.map(async report => {
    if (!report.studentName) {
      await reports.update(report.id, { studentName: report.studentName || 'Unknown Student' });
      return 1;
    }
    return 0;
  })).then(results => results.reduce((a: number, b: number) => a + b, 0));
  
  return { classesUpdated, reportsUpdated };
};

export const cleanupDuplicateReports = async (studentId: string): Promise<void> => {
  const reports = await getReportsForStudent(studentId);
  if (reports.length <= 1) return;
  
  const batch = writeBatch(db);
  (reports as ReportData[]).slice(1).forEach(report => batch.delete(doc(db, 'reports', report.id)));
  await batch.commit();
};

export const removeDuplicateAdminUsers = async (): Promise<{ removed: number; kept: number }> => {
  const users = await getAllUsers();
  const emailGroups = users.reduce((acc, user) => {
    if (!acc[user.email]) acc[user.email] = [];
    acc[user.email].push(user);
    return acc;
  }, {} as Record<string, AdminUser[]>);
  
  let removed = 0;
  let kept = 0;
  
  for (const [, userGroup] of Object.entries(emailGroups)) {
    if ((userGroup as AdminUser[]).length > 1) {
      const batch = writeBatch(db);
      (userGroup as AdminUser[]).slice(1).forEach(user => batch.delete(doc(db, 'adminUsers', user.id)));
      await batch.commit();
      removed += (userGroup as AdminUser[]).length - 1;
      kept += 1;
    } else {
      kept += 1;
    }
  }
  
  return { removed, kept };
};

export const isUserWhitelisted = async (email: string): Promise<boolean> => 
  (await getDocsByQuery('whitelistedUsers', [['email', '==', email]])).length > 0;
