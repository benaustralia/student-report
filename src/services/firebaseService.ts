import { signInWithPopup, signInWithCredential, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, deleteField, writeBatch, setDoc, enableNetwork, disableNetwork } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import type { Class, Student, ReportData, Teacher, AdminUser, LegacyReportData } from '../types';

export interface UserData { uid: string; email: string; displayName: string; isWhitelisted: boolean; }

const createDoc = async (collectionName: string, data: Record<string, unknown>, customId?: string) => {
  if (customId) {
    await setDoc(doc(db, collectionName, customId), { ...data, createdAt: new Date(), updatedAt: new Date() });
    return customId;
  }
  return (await addDoc(collection(db, collectionName), { ...data, createdAt: new Date(), updatedAt: new Date() })).id;
};
const getDocsByQuery = async <T>(collectionName: string, conditions: [string, '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'not-in' | 'array-contains-any', unknown][] = []): Promise<T[]> => {
  const q = conditions.length ? query(collection(db, collectionName), ...conditions.map(([field, op, value]) => where(field, op, value))) : collection(db, collectionName);
  const snapshot = await getDocs(q);
  
  // Always use Firestore document ID as the single source of truth
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
};
const updateDocById = async (collectionName: string, id: string, updates: Record<string, unknown>) => await updateDoc(doc(db, collectionName, id), { ...updates, updatedAt: new Date() });
const deleteDocById = async (collectionName: string, id: string) => {
  return await deleteDoc(doc(db, collectionName, id));
};

export const signInWithGoogle = async (credential?: string) => {
  if (credential) {
    // Use Google Identity Services credential
    const googleCredential = GoogleAuthProvider.credential(credential);
    return (await signInWithCredential(auth, googleCredential)).user;
  } else {
    // Fallback to popup method
    return (await signInWithPopup(auth, googleProvider)).user;
  }
};
export const signOutUser = async () => await signOut(auth);
export const onAuthStateChange = (callback: (user: unknown) => void) => onAuthStateChanged(auth, callback);
export const isUserAdmin = async (email: string): Promise<boolean> => {
  try {
    console.log('isUserAdmin: Checking admin status for:', email);
    const result = await getDocsByQuery('adminUsers', [['email', '==', email], ['isAdmin', '==', true]]);
    console.log('isUserAdmin: Query result for', email, ':', result);
    console.log('isUserAdmin: Is admin?', result.length > 0);
    return result.length > 0;
  } catch (error) {
    console.error('isUserAdmin: Error checking admin status for', email, ':', error);
    return false;
  }
};

export const createLegacyReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => await createDoc('reports', reportData);
export const getReportsByUser = async (userId: string): Promise<ReportData[]> => (await getDocsByQuery<ReportData>('reports', [['userId', '==', userId]])).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
export const getAllReports = async (): Promise<ReportData[]> => (await getDocsByQuery<ReportData>('reports')).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const getClassesForTeacher = async (teacherEmail: string): Promise<Class[]> => (await getDocsByQuery<Class>('classes', [['teacherEmail', '==', teacherEmail]])).sort((a, b) => a.classLevel.localeCompare(b.classLevel));
export const getStudentsForClass = async (classId: string): Promise<Student[]> => (await getDocsByQuery<Student>('students', [['classId', '==', classId]])).sort((a, b) => a.lastName.localeCompare(b.lastName));
export const getStudentCountsForClasses = async (classIds: string[]): Promise<Record<string, number>> => {
  if (classIds.length === 0) return {};
  
  // Get all students for the given class IDs in a single query
  const students = await getDocsByQuery<Student>('students', [['classId', 'in', classIds]]);
  
  // Count students per class
  const counts: Record<string, number> = {};
  classIds.forEach(classId => counts[classId] = 0);
  
  students.forEach(student => {
    if (student.classId && Object.prototype.hasOwnProperty.call(counts, student.classId)) {
      counts[student.classId]++;
    }
  });
  
  return counts;
};
export const getReportsForStudent = async (studentId: string): Promise<ReportData[]> => {
  const reports = await getDocsByQuery<ReportData>('reports', [['studentId', '==', studentId]]);
  return reports.length > 0 ? [reports.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]] : [];
};
export const getReportsForClass = async (classId: string): Promise<ReportData[]> => (await getDocsByQuery<ReportData>('reports', [['classId', '==', classId]])).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const createOrUpdateReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existingReports = await getDocsByQuery<ReportData>('reports', [['studentId', '==', reportData.studentId]]);
  if (existingReports.length === 0) return await createDoc('reports', reportData);
  const existingId = existingReports[0].id;
  const updateData: Record<string, unknown> = { ...reportData, updatedAt: new Date() };
  if (!('artworkUrl' in reportData)) updateData.artworkUrl = deleteField();
  await updateDocById('reports', existingId, updateData);
  return existingId;
};
export const createReport = async (reportData: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => await createOrUpdateReport(reportData);
export const updateReport = async (reportId: string, updates: Partial<ReportData>): Promise<void> => await updateDocById('reports', reportId, updates);
export const deleteReport = async (reportId: string): Promise<void> => await deleteDocById('reports', reportId);

export const getUserDisplayName = async (email: string): Promise<string | null> => {
  const users = await getDocsByQuery<AdminUser>('adminUsers', [['email', '==', email]]);
  return users.length > 0 ? `${users[0].firstName} ${users[0].lastName}`.trim() : null;
};
export const getAllUsers = async (): Promise<AdminUser[]> => await getDocsByQuery<AdminUser>('adminUsers').catch(() => []);

// Temporary debugging function to check admin status for any email
export const debugCheckAdminStatus = async (email: string): Promise<void> => {
  try {
    console.log('=== DEBUG: Checking admin status for', email, '===');
    const allUsers = await getAllUsers();
    console.log('All users in adminUsers collection:', allUsers);
    
    const userWithEmail = allUsers.find(user => user.email === email);
    console.log('User found with email', email, ':', userWithEmail);
    
    if (userWithEmail) {
      console.log('Is admin?', userWithEmail.isAdmin);
    } else {
      console.log('No user found with email:', email);
    }
    console.log('=== END DEBUG ===');
  } catch (error) {
    console.error('Debug check failed:', error);
  }
};
export const getAllClasses = async (): Promise<Class[]> => {
  try {
    console.log('getAllClasses: Starting query...');
    const result = await getDocsByQuery<Class>('classes');
    console.log('getAllClasses: Query result:', result);
    console.log('getAllClasses: Result count:', result.length);
    return result;
  } catch (error) {
    console.error('getAllClasses: Error occurred:', error);
    return [];
  }
};
export const getAllStudents = async (): Promise<Student[]> => {
  return await getDocsByQuery<Student>('students').catch(() => []);
};

// Force refresh function to clear cache and get fresh data from Firestore
export const forceRefreshStudents = async (): Promise<Student[]> => {
  try {
    // Temporarily disable network to clear cache
    await disableNetwork(db);
    await enableNetwork(db);
    
    // Fetch fresh data from Firestore (single source of truth)
    return await getDocsByQuery<Student>('students').catch(() => []);
  } catch (error) {
    console.error('Error refreshing students data:', error);
    // Fallback to regular fetch
    return await getAllStudents();
  }
};
export const getAllTeachers = async (): Promise<Teacher[]> => await getDocsByQuery<Teacher>('teachers').catch(() => []);
export const isUserWhitelisted = async (email: string): Promise<boolean> => (await getDocsByQuery('whitelistedUsers', [['email', '==', email]])).length > 0;

export const importUsers = async (usersData: AdminUser[]): Promise<void> => {
  usersData.forEach(user => { if (!user.email || !user.firstName || !user.lastName) throw new Error(`Invalid user data: ${JSON.stringify(user)}`); });
  const adminUsers = usersData.filter(user => user.isAdmin === true);
  const teachers = usersData.filter(user => user.isAdmin === false || user.isAdmin === undefined);
  if (adminUsers.length > 0) await Promise.all(adminUsers.map(user => createDoc('adminUsers', { ...user }, `${user.firstName}-${user.lastName}`)));
  if (teachers.length > 0) await Promise.all(teachers.map(teacher => createDoc('teachers', { ...teacher }, `${teacher.firstName}-${teacher.lastName}`)));
};
export const importClasses = async (classesData: Class[]): Promise<void> => {
  const users = await getAllUsers();
  const userMap = new Map(users.map(user => [user.email, user]));
  await Promise.all(classesData.map(classData => {
    const teacher = userMap.get(classData.teacherEmail);
    if (!teacher && !classData.teacherFirstName) throw new Error(`Teacher ${classData.teacherEmail} not found`);
    const teacherName = teacher ? `${teacher.firstName}-${teacher.lastName}` : classData.teacherEmail.split('@')[0];
    const classId = `${classData.classDay}-${classData.classTime.replace(/[^a-zA-Z0-9]/g, '')}-${teacherName}`;
    return createDoc('classes', { ...classData, teacherFirstName: teacher?.firstName, teacherLastName: teacher?.lastName }, classId);
  }));
};
export const importStudents = async (studentsData: Student[]): Promise<void> => {
  const classes = await getAllClasses();
  await Promise.all(studentsData.map(async student => {
    let classId = student.classId;
    if (!classId && student.teacherEmail) {
      const matchingClass = classes.find(cls => cls.teacherEmail === student.teacherEmail);
      if (matchingClass) classId = matchingClass.id;
    }
    const studentData = { ...student, classId: classId || 'unknown', firstName: student.firstName, lastName: student.lastName };
    const studentId = `${student.firstName}-${student.lastName}-${classId?.split('-')[0] || 'unknown'}`;
    await createDoc('students', studentData, studentId);
  }));
};

export const importTeachers = async (teachersData: Teacher[]): Promise<void> => {
  teachersData.forEach(teacher => { 
    if (!teacher.firstName || !teacher.lastName || !teacher.email) 
      throw new Error(`Invalid teacher data: ${JSON.stringify(teacher)}`); 
  });
  await Promise.all(teachersData.map(async teacher => {
    const teacherId = `${teacher.firstName}-${teacher.lastName}-${teacher.email.split('@')[0]}`;
    await createDoc('teachers', { ...teacher }, teacherId);
  }));
};

// Migration function to update existing data with new IDs
export const migrateToCustomIds = async (): Promise<void> => {
  console.log('Starting migration to custom IDs...');
  
  // Get all existing data
  const [existingUsers, existingClasses, existingStudents] = await Promise.all([
    getAllUsers(),
    getAllClasses(), 
    getAllStudents()
  ]);
  
  console.log(`Found ${existingUsers.length} users, ${existingClasses.length} classes, ${existingStudents.length} students`);
  
  // Create user map for class migration
  const userMap = new Map(existingUsers.map(user => [user.email, user]));
  
  // Migrate classes first (students depend on them)
  const classIdMap = new Map();
  for (const classData of existingClasses) {
    const teacher = userMap.get(classData.teacherEmail);
    const teacherName = teacher ? `${teacher.firstName}-${teacher.lastName}` : classData.teacherEmail.split('@')[0];
    const newClassId = `${classData.classDay}-${classData.classTime.replace(/[^a-zA-Z0-9]/g, '')}-${teacherName}`;
    
    console.log(`Migrating class: ${classData.id} -> ${newClassId}`);
    
    // Store mapping for student migration
    classIdMap.set(classData.id, newClassId);
    
    // Create new class with custom ID
    await createDoc('classes', { 
      ...classData, 
      teacherFirstName: teacher?.firstName, 
      teacherLastName: teacher?.lastName 
    }, newClassId);
    
    // Delete old class
    await deleteDocById('classes', classData.id);
  }
  
  console.log('Class ID mapping:', Array.from(classIdMap.entries()));
  
  // Migrate students
  const studentIdCounts = new Map();
  for (const student of existingStudents) {
    let newClassId = classIdMap.get(student.classId);
    
    // If class ID not found in mapping, try to find a matching class by teacher email
    if (!newClassId && student.teacherEmail) {
      const matchingClass = existingClasses.find(cls => cls.teacherEmail === student.teacherEmail);
      if (matchingClass) {
        newClassId = classIdMap.get(matchingClass.id);
        console.log(`Found matching class for student ${student.firstName} ${student.lastName} by teacher email: ${newClassId}`);
      }
    }
    
    // If still no class ID found, use a generic one
    if (!newClassId) {
      newClassId = `unknown-class-${student.classId?.slice(0, 8) || 'no-class'}`;
      console.warn(`No matching class found for student ${student.firstName} ${student.lastName}, using: ${newClassId}`);
    }
    
    console.log(`Student ${student.firstName} ${student.lastName}: old classId=${student.classId}, new classId=${newClassId}`);
    
    let newStudentId = `${student.firstName}-${student.lastName}-${newClassId?.split('-')[0] || 'unknown'}`;
    
    // Ensure uniqueness by adding a counter if needed
    if (studentIdCounts.has(newStudentId)) {
      const count = studentIdCounts.get(newStudentId) + 1;
      studentIdCounts.set(newStudentId, count);
      newStudentId = `${newStudentId}-${count}`;
    } else {
      studentIdCounts.set(newStudentId, 1);
    }
    
    console.log(`Migrating student: ${student.firstName} ${student.lastName} -> ${newStudentId}`);
    
    // Create new student with custom ID
    await createDoc('students', { 
      ...student, 
      classId: newClassId 
    }, newStudentId);
    
    // Delete old student
    await deleteDocById('students', student.id);
  }
  
  // Migrate users
  for (const user of existingUsers) {
    const newUserId = `${user.firstName}-${user.lastName}`;
    const collection = user.isAdmin ? 'adminUsers' : 'teachers';
    
    // Create new user with custom ID
    await createDoc(collection, { ...user }, newUserId);
    
    // Delete old user
    await deleteDocById(collection, user.id);
  }
  
  console.log('Migration completed successfully!');
};

// Update and Delete functions for Data Builder
export const updateUser = async (userId: string, updates: Partial<AdminUser>): Promise<void> => {
  await updateDocById('adminUsers', userId, updates);
};

export const deleteUser = async (userId: string): Promise<void> => {
  await deleteDocById('adminUsers', userId);
};

export const updateClass = async (classId: string, updates: Partial<Class>): Promise<void> => {
  await updateDocById('classes', classId, updates);
};

export const deleteClass = async (classId: string): Promise<void> => {
  await deleteDocById('classes', classId);
};

export const updateStudent = async (studentId: string, updates: Partial<Student>): Promise<void> => {
  await updateDocById('students', studentId, updates);
};

export const deleteStudent = async (studentId: string): Promise<void> => {
  await deleteDocById('students', studentId);
};

export const updateTeacher = async (teacherId: string, updates: Partial<Teacher>): Promise<void> => {
  await updateDocById('teachers', teacherId, updates);
};

export const deleteTeacher = async (teacherId: string): Promise<void> => {
  await deleteDocById('teachers', teacherId);
};

export const importReports = async (reportsData: LegacyReportData[]): Promise<void> => {
  const [students, classes] = await Promise.all([getAllStudents(), getAllClasses()]);
  await Promise.all(reportsData.map(async report => {
    const student = students.find(s => `${s.firstName} ${s.lastName}` === report.studentName);
    const classData = classes.find(c => c.teacherEmail === report.teacher);
    const reportData = { ...report, studentId: student?.id || 'unknown', classId: classData?.id || 'unknown', teacherEmail: report.teacher, reportText: report.comments };
    await createDoc('reports', reportData);
  }));
};

export const getAdminUserByEmail = async (email: string): Promise<AdminUser | null> => {
  const users = await getDocsByQuery<AdminUser>('adminUsers', [['email', '==', email]]);
  return users.length > 0 ? users[0] : null;
};
export const updateAdminUser = async (email: string, updateData: Partial<AdminUser>): Promise<boolean> => {
  const users = await getDocsByQuery<AdminUser>('adminUsers', [['email', '==', email]]);
  if (users.length === 0) return false;
  await Promise.all(users.map(user => updateDocById('adminUsers', user.id, updateData)));
  return true;
};
export const removeAdminUserByEmail = async (email: string): Promise<boolean> => {
  const users = await getDocsByQuery<AdminUser>('adminUsers', [['email', '==', email]]);
  if (users.length === 0) return false;
  await Promise.all(users.map(user => deleteDocById('adminUsers', user.id)));
  return true;
};

export const getUniqueTeacherCount = async (): Promise<number> => (await getAllTeachers()).length;
export const getTeacherUserCount = async (): Promise<number> => {
  const [classes, adminUsers] = await Promise.all([getAllClasses(), getAllUsers()]);
  const teacherEmails = new Set(classes.map(cls => cls.teacherEmail));
  const adminEmails = new Set(adminUsers.map(user => user.email));
  return [...teacherEmails].filter(email => !adminEmails.has(email)).length;
};
export const getTeacherByEmail = async (email: string): Promise<Teacher | null> => await getAdminUserByEmail(email);

// Get report counts for all teachers (admin only)
export const getTeacherReportCounts = async (): Promise<Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>> => {
  const [allReports, allClasses, allStudents, allTeachers] = await Promise.all([
    getAllReports(),
    getAllClasses(),
    getAllStudents(),
    getAllTeachers()
  ]);

  const teacherMap = new Map(allTeachers.map(teacher => [teacher.email, teacher]));
  const classMap = new Map(allClasses.map(cls => [cls.id, cls]));
  
  // Count reports by teacher email
  const reportCounts: Record<string, number> = {};
  allReports.forEach(report => {
    const classData = classMap.get(report.classId);
    if (classData) {
      reportCounts[classData.teacherEmail] = (reportCounts[classData.teacherEmail] || 0) + 1;
    }
  });

  // Count students by teacher email
  const studentCounts: Record<string, number> = {};
  allStudents.forEach(student => {
    const classData = classMap.get(student.classId);
    if (classData) {
      studentCounts[classData.teacherEmail] = (studentCounts[classData.teacherEmail] || 0) + 1;
    }
  });

  // Combine data
  const result: Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }> = {};
  
  // Include all teachers (even those with 0 reports)
  allClasses.forEach(cls => {
    const teacherEmail = cls.teacherEmail;
    if (!result[teacherEmail]) {
      const teacher = teacherMap.get(teacherEmail);
      result[teacherEmail] = {
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : teacherEmail,
        teacherEmail,
        reportCount: reportCounts[teacherEmail] || 0,
        studentCount: studentCounts[teacherEmail] || 0
      };
    }
  });

  return result;
};

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
  const usersByEmail = new Map<string, AdminUser[]>();
  users.forEach(user => { const email = user.email; if (!usersByEmail.has(email)) usersByEmail.set(email, []); usersByEmail.get(email)!.push(user); });
  let removed = 0, kept = 0;
  for (const [, userList] of usersByEmail) {
    if (userList.length > 1) { const sorted = userList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); await Promise.all(sorted.slice(1).map(user => deleteDocById('adminUsers', user.id))); removed += sorted.length - 1; kept += 1; } else { kept += 1; }
  }
  return { removed, kept };
};