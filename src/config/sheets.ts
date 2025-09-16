// Google Sheets Configuration
// Replace with your actual Google Sheet ID from the URL
// Example: https://docs.google.com/spreadsheets/d/1ABC123DEF456GHI789JKL/edit
// Sheet ID would be: 1ABC123DEF456GHI789JKL

export const GOOGLE_SHEET_ID = '16Dq3MzbEjVbczOcSBXL413ma0g9mbedVM3WtxDmt2vA';

// Optional: Configure which columns to use for different fields
export const COLUMN_MAPPING = {
  teacher: 'TEACHER',
  teacherFirstName: 'Teacher First Name',
  teacherLastName: 'Teacher Last Na',
  classDay: 'Class Day',
  classTime: 'Class Time',
  classLocation: 'Class Location',
  classLevel: 'Class Level',
  report: 'Report',
  artwork: 'Artwork',
  studentFirstName: 'Student First Na',
  studentLastName: 'Student Last Name',
} as const;

