export interface Report {
  id: number;
  teacher: string;
  class: string;
  student: string;
  grade: string;
  comments: string;
  [key: string]: any;
}

export interface ClassData {
  class: string;
  reports: Report[];
}

export type GroupedReports = Record<string, Record<string, ClassData>>;

export interface ReportData {
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date?: string;
  artwork?: string; // Image URL for student artwork
}
