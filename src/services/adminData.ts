import { getAllUsers, getAllClasses, getAllStudents, getAllTeachers, getTeacherReportCounts, getIncompleteReports, getUserDisplayName } from '@/services/firebaseService-ultra-final';
import type { AdminUser, Class, Student, Teacher, ReportData } from '@/types';

export interface AdminPanelData {
  users: AdminUser[];
  classes: Class[];
  students: Student[];
  teachers: Teacher[];
  teacherReportStats: Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>;
  incompleteReports: ReportData[];
  teacherDisplayNames: Record<string, string>;
  teacherCount: number;
  adminCount: number;
}

export async function loadAdminPanelData(): Promise<AdminPanelData> {
  const [adminUsers, teachers, classes, students, teacherReportStats, incompleteReports] = await Promise.all([
    getAllUsers().catch(() => []), 
    getAllTeachers().catch(() => []), 
    getAllClasses().catch(() => []), 
    getAllStudents().catch(() => []),
    getTeacherReportCounts().catch(() => ({})),
    getIncompleteReports().catch(() => [])
  ]);
  const teacherDisplayNames: Record<string, string> = {};
  const uniqueTeacherEmails = [...new Set(classes.map(c => c.teacherEmail))];
  await Promise.all(uniqueTeacherEmails.map(async (email) => {
    try {
      const displayName = await getUserDisplayName(email);
      teacherDisplayNames[email] = displayName || 'Unknown Teacher';
    } catch {
      teacherDisplayNames[email] = 'Unknown Teacher';
    }
  }));
  const userMap = new Map<string, any>();
  teachers.forEach(t => t.email && userMap.set(t.email, { ...t, isAdmin: false }));
  adminUsers.forEach(a => a.email && userMap.set(a.email, { ...a, isAdmin: a.isAdmin || false }));
  const allUsers = Array.from(userMap.values());
  const teacherMap = new Map<string, Teacher>();
  teachers.forEach(t => t.email && teacherMap.set(t.email, t));
  const uniqueTeachers = Array.from(teacherMap.values());
  return {
    users: allUsers,
    classes,
    students,
    teachers: uniqueTeachers,
    teacherReportStats,
    incompleteReports,
    teacherDisplayNames,
    teacherCount: uniqueTeachers.length,
    adminCount: allUsers.filter(u => u.isAdmin).length
  };
}
