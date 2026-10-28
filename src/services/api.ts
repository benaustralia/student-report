// Data access for the app — a drop-in for the old firebaseService-ultra-final.ts, with the
// same export names, now backed by /api/data (Neon Postgres) instead of Firestore.
import type { AdminUser, Class, LegacyReportData, ReportData, Request, Student, Teacher, User } from '@/types';
import { api, query } from './http';

type Collection = 'reports' | 'classes' | 'students' | 'teachers' | 'adminUsers' | 'requests';
type Filters = Record<string, string | string[] | undefined>;

const list = <T>(c: Collection, filters: Filters = {}) => api<T[]>(`/api/data/${c}${query(filters)}`);
const create = <T>(c: Collection, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) =>
  api<{ id: string }>(`/api/data/${c}`, { json: data }).then(r => r.id);
const createMany = async <T>(c: Collection, items: T[]) => {
  if (!items.length) return;
  await api<{ ids: string[] }>(`/api/data/${c}`, { json: items });
};
const update = <T>(c: Collection, id: string, updates: Partial<T>) => api<T>(`/api/data/${c}/${encodeURIComponent(id)}`, { method: 'PATCH', json: updates }).then(() => undefined);
const remove = (c: Collection, id: string) => api(`/api/data/${c}/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => undefined);
const removeMany = async (c: Collection, ids: string[]) => {
  if (!ids.length) return;
  await api(`/api/data/${c}/delete-many`, { json: { ids } });
};
const safeList = <T>(c: Collection, filters: Filters = {}) => list<T>(c, filters).catch(() => [] as T[]);

const byNewest = <T extends { createdAt: Date | string }>(rows: T[]) =>
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

// ---- session ------------------------------------------------------------------------------
let meCache: Promise<User | null> | null = null;
export const getMe = (): Promise<User | null> =>
  (meCache ??= api<User>('/api/me').catch(() => null));
export const clearMeCache = () => { meCache = null; };

/** Kept for call-site compatibility: the server decides from the session, the email is ignored. */
export const isUserAdmin = async (_email: string): Promise<boolean> => (await getMe())?.role === 'admin';

const displayNameCache = new Map<string, Promise<string | null>>();
export const getUserDisplayName = (email: string): Promise<string | null> => {
  const e = (email || '').toLowerCase().trim();
  if (!e) return Promise.resolve(null);
  if (!displayNameCache.has(e)) {
    displayNameCache.set(e, (async () => {
      const [admins, teachers] = await Promise.all([safeList<AdminUser>('adminUsers', { email: e }), safeList<Teacher>('teachers', { email: e })]);
      const hit = admins[0] ?? teachers[0];
      return hit ? `${hit.firstName} ${hit.lastName}`.trim() || null : null;
    })());
  }
  return displayNameCache.get(e)!;
};

/** No-op kept so callers need not change: the API has nothing to warm. */
export const prefetchCriticalData = async () => {};

// ---- reports ------------------------------------------------------------------------------
export const createLegacyReport = (data: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>) => create<ReportData>('reports', data);
export const getAllReports = () => safeList<ReportData>('reports').then(byNewest);
export const getReportsForStudent = (studentId: string) => list<ReportData>('reports', { studentId }).then(byNewest);
export const getReportsForClass = (classId: string) => list<ReportData>('reports', { classId }).then(byNewest);
export const getIncompleteReports = () => getAllReports().then(rs => rs.filter(r => !r.studentName || !r.reportText));
export const cleanReportsWithoutStudentNames = async () =>
  removeMany('reports', (await getAllReports()).filter(r => !r.studentName).map(r => r.id));
export const createOrUpdateReport = (data: Omit<ReportData, 'id' | 'createdAt' | 'updatedAt'>) =>
  api<{ id: string }>('/api/rpc/createOrUpdateReport', { json: data }).then(r => r.id);
export const createReport = createLegacyReport;
export const updateReport = (id: string, updates: Partial<ReportData>) => update<ReportData>('reports', id, updates);
export const deleteReport = (id: string) => remove('reports', id);
export const cleanupDuplicateReports = async (studentId: string) => {
  const rs = await getReportsForStudent(studentId);
  if (rs.length > 1) await removeMany('reports', rs.slice(1).map(r => r.id));
};
export const importReports = (rows: LegacyReportData[]) => createMany('reports', rows);

// ---- classes / students / teachers / users ------------------------------------------------
export const getAllClasses = () => safeList<Class>('classes');
export const getAllStudents = () => safeList<Student>('students');
export const getAllTeachers = () => safeList<Teacher>('teachers');
export const getAllUsers = () => safeList<AdminUser>('adminUsers');

export const getClassesForTeacher = (teacherEmail: string) =>
  list<Class>('classes', { teacherEmail }).then(cs => cs.sort((a, b) => a.classLevel.localeCompare(b.classLevel)));
export const getStudentsForClass = (classId: string) =>
  list<Student>('students', { classId }).then(ss => ss.sort((a, b) => a.lastName.localeCompare(b.lastName)));
export const getStudentCountsForClasses = async (classIds: string[]): Promise<Record<string, number>> => {
  if (!classIds.length) return {};
  const counts = Object.fromEntries(classIds.map(id => [id, 0]));
  for (const s of await list<Student>('students', { classId: classIds })) if (s.classId in counts) counts[s.classId]++;
  return counts;
};

export const importUsers = (rows: AdminUser[]) => createMany('adminUsers', rows);
export const importClasses = (rows: Class[]) => createMany('classes', rows);
export const importStudents = (rows: Student[]) => createMany('students', rows);
export const importTeachers = (rows: Teacher[]) => createMany('teachers', rows);

export const updateUser = (id: string, u: Partial<AdminUser>) => update<AdminUser>('adminUsers', id, u);
export const updateClass = (id: string, u: Partial<Class>) => update<Class>('classes', id, u);
export const updateStudent = (id: string, u: Partial<Student>) => update<Student>('students', id, u);
export const updateTeacher = (id: string, u: Partial<Teacher>) => update<Teacher>('teachers', id, u);
export const deleteUser = (id: string) => remove('adminUsers', id);
export const deleteClass = (id: string) => remove('classes', id);
export const deleteStudent = (id: string) => remove('students', id);
export const deleteTeacher = (id: string) => remove('teachers', id);

// ---- requests -----------------------------------------------------------------------------
export const createRequest = (data: Omit<Request, 'id' | 'createdAt' | 'updatedAt'>) => create<Request>('requests', data);
export const getAllRequests = () => safeList<Request>('requests');
export const getRequestsForTeacher = (teacherEmail: string) => list<Request>('requests', { teacherEmail });
export const getPendingRequests = () => list<Request>('requests', { status: 'pending' });
export const updateRequest = (id: string, u: Partial<Request>) => update<Request>('requests', id, u);
export const deleteRequest = (id: string) => remove('requests', id);
export const approveRequest = (requestId: string, _adminEmail: string) => api('/api/rpc/approveRequest', { json: { requestId } }).then(() => undefined);
export const declineRequest = (requestId: string, _adminEmail: string) => api('/api/rpc/declineRequest', { json: { requestId } }).then(() => undefined);
export const importRequests = (rows: Request[]) => createMany('requests', rows);

// ---- admin utilities ----------------------------------------------------------------------
export const getOrphanedStudents = () => list<Student>('students', { classId: '' });
export const cleanupOrphanedStudents = async () => {
  const students = await getOrphanedStudents();
  await removeMany('students', students.map(s => s.id));
  return { deleted: students.length, students };
};

export const getAdminUserByEmail = (email: string) => safeList<AdminUser>('adminUsers', { email }).then(us => us[0] ?? null);
export const updateAdminUser = async (email: string, u: Partial<AdminUser>) => {
  const user = await getAdminUserByEmail(email);
  return user ? (await updateUser(user.id, u), true) : false;
};
export const removeAdminUserByEmail = async (email: string) => {
  const user = await getAdminUserByEmail(email);
  return user ? (await deleteUser(user.id), true) : false;
};

export const getUniqueTeacherCount = () => getAllTeachers().then(ts => ts.length);
export const getTeacherUserCount = getUniqueTeacherCount;
export const getTeacherByEmail = (email: string) =>
  email?.trim() ? safeList<Teacher>('teachers', { email }).then(ts => ts[0] ?? null) : Promise.resolve(null);

export const getTeacherReportCounts = async () => {
  const [teachers, classes, students, reports] = await Promise.all([getAllTeachers(), getAllClasses(), getAllStudents(), getAllReports()]);
  return Object.fromEntries(teachers.map(t => {
    const mine = new Set(classes.filter(c => c.teacherEmail === t.email).map(c => c.id));
    return [t.email, {
      teacherName: `${t.firstName} ${t.lastName}`,
      teacherEmail: t.email,
      reportCount: reports.filter(r => mine.has(r.classId)).length,
      studentCount: students.filter(s => mine.has(s.classId)).length,
    }];
  })) as Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>;
};

export const migrateDataStructure = async () => {
  const [cs, rs] = await Promise.all([getAllClasses(), getAllReports()]);
  let classesUpdated = 0, reportsUpdated = 0;
  for (const c of cs) if (!c.classLevel || !c.classDay || !c.classTime) {
    await updateClass(c.id, { classLevel: c.classLevel || 'Unknown', classDay: c.classDay || 'Unknown', classTime: c.classTime || 'Unknown' });
    classesUpdated++;
  }
  for (const r of rs) if (!r.studentName) { await updateReport(r.id, { studentName: 'Unknown Student' }); reportsUpdated++; }
  return { classesUpdated, reportsUpdated };
};

export const removeDuplicateAdminUsers = async () => {
  const groups = new Map<string, AdminUser[]>();
  for (const u of await getAllUsers()) groups.set(u.email, [...(groups.get(u.email) ?? []), u]);
  let removed = 0, kept = 0;
  for (const g of groups.values()) { await removeMany('adminUsers', g.slice(1).map(u => u.id)); removed += g.length - 1; kept++; }
  return { removed, kept };
};

export const deduplicateStudents = async () => {
  const groups = new Map<string, Student[]>();
  for (const s of await getAllStudents()) {
    const k = `${s.firstName}|${s.lastName}|${s.classId}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  let removed = 0, kept = 0;
  const details: Array<{ studentName: string; classId: string; removedCount: number }> = [];
  for (const g of groups.values()) {
    kept++;
    if (g.length > 1) {
      await removeMany('students', g.slice(1).map(s => s.id));
      removed += g.length - 1;
      details.push({ studentName: `${g[0].firstName} ${g[0].lastName}`, classId: g[0].classId, removedCount: g.length - 1 });
    }
  }
  return { removed, kept, details };
};

// ---- AI draft -----------------------------------------------------------------------------
export const draftReport = (input: { firstName: string; lastName: string; classLevel: string; notes: string }) =>
  api<{ text: string }>('/api/ai-draft', { json: input }).then(r => r.text);

// ---- stats --------------------------------------------------------------------------------
export const getStats = () => api<{ userCount: number; classCount: number; studentCount: number }>('/api/rpc/stats');
