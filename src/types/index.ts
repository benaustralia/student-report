// Legacy types (keeping for compatibility)
export interface Report {
  id: number;
  teacher: string;
  class: string;
  student: string;
  grade: string;
  comments: string;
  [key: string]: unknown;
}

export interface ClassData {
  class: string;
  reports: Report[];
}

export type GroupedReports = Record<string, Record<string, ClassData>>;

// Legacy ReportData interface for backward compatibility
export interface LegacyReportData {
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date: string;
  artwork?: string;
}

// New RBA structure - Normalized
export interface Class {
  id: string;
  teacherEmail: string;
  classDay: string;
  classTime: string;
  classLocation: string;
  classLevel: string;
  teacherFirstName?: string;  // Added for import compatibility
  teacherLastName?: string;   // Added for import compatibility
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  classId: string;
  firstName: string;
  lastName: string;
  teacherEmail?: string;  // Added for simplified import structure
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportData {
  id: string;
  studentId: string;
  classId: string;
  teacherEmail: string;
  reportText: string;
  artworkUrl?: string;
  studentName?: string;  // Added for simplified import structure
  createdAt: Date;
  updatedAt: Date;
}

// Teacher type
export interface Teacher {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

// Admin user type
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}
