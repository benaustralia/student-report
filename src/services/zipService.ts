import type { ReportData } from '@/types';

// Dynamic import for JSZip to reduce initial bundle size
const getJSZip = async () => {
  const { default: JSZip } = await import('jszip');
  return JSZip;
};

// Helper function to safely convert Firestore timestamps to Date objects
const toDate = (dateValue: any): Date => {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Handle null, undefined, or empty values
  if (!dateValue) {
    return new Date(); // Return current date as fallback
  }
  
  // Try to create a date from the value
  const date = new Date(dateValue);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date value:', dateValue, 'using current date as fallback');
    return new Date(); // Return current date as fallback
  }
  
  return date;
};

// Legacy types for existing functionality
export interface ClassReport {
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date: string;
}

export const downloadClassAsZIP = async (reports: ReportData[], className: string, students: any[], teacher: any) => {
  try {
    const JSZip = await getJSZip();
    const zip = new JSZip();
    const folder = zip.folder(className);

    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }

    // Process each report
    for (const report of reports) {
      try {
        // Find student and teacher data
        const student = students.find(s => s.id === report.studentId);
        const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';
        const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher';
        
        // Convert to legacy format for PDF generation
        const legacyReportData = {
          studentName,
          classLevel: className, // Use className as classLevel
          classLocation: 'Unknown Location', // This would need to be passed in
          comments: report.reportText,
          teacher: teacherName,
          date: toDate(report.createdAt).toLocaleDateString(),
          artwork: report.artworkUrl || ''
        };

        // Generate PDF blob
        const pdfBlob = await generatePDFBlob(legacyReportData);
        
        // Add to ZIP
        const fileName = `${student.firstName || 'Unknown'}_${student.lastName || 'Student'}_${toDate(report.createdAt).toISOString().split('T')[0]}.pdf`;
        folder.file(fileName, pdfBlob);
      } catch (error) {
        console.error(`Error processing report for student ${report.studentId}:`, error);
        // Continue with other reports even if one fails
      }
    }

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${className}_reports.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    throw error;
  }
};

// Legacy function for existing ClassZIPButton
export const generateClassZIP = async (reports: ClassReport[], className: string, teacherName: string) => {
  try {
    const JSZip = await getJSZip();
    const zip = new JSZip();
    const folder = zip.folder(`${teacherName}_${className}`);

    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }

    // Process each report
    for (const report of reports) {
      try {
        // Generate PDF blob using the existing PDF service
        const pdfBlob = await generatePDFBlob(report);
        
        // Add to ZIP
        const fileName = `${report.studentName.replace(/\s+/g, '_')}_${report.date.replace(/\//g, '-')}.pdf`;
        folder.file(fileName, pdfBlob);
      } catch (error) {
        console.error(`Error processing report for ${report.studentName}:`, error);
        // Continue with other reports even if one fails
      }
    }

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${teacherName}_${className}_reports.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    throw error;
  }
};

// Helper function to generate PDF as blob instead of downloading
const generatePDFBlob = async (reportData: any): Promise<Blob> => {
  // This is a simplified version - you'll need to implement the actual PDF generation
  // that returns a blob instead of triggering a download
  // For now, we'll create a placeholder blob
  const placeholderText = `Report for ${reportData.studentName}\nClass: ${reportData.classLevel}\nLocation: ${reportData.classLocation}\nTeacher: ${reportData.teacher}\nDate: ${reportData.date}\n\nComments:\n${reportData.comments}`;
  
  return new Blob([placeholderText], { type: 'application/pdf' });
};