import type { ReportData, Student, Teacher } from '@/types';
import { refreshDownloadURL } from './storageService';
import { isReportReadyForPDF } from './pdfGenerationService';
import { generatePDFBlob, type ClassReport } from './zipPDFGenerator';

const DEBUG = true;

const getJSZip = async () => (await import('jszip')).default;

const toDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object') {
    if ('seconds' in v) return new Date((v as { seconds: number }).seconds * 1000);
    if ('toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate();
    }
  }
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? new Date() : d;
};

export interface ZIPGenerationResult {
  successCount: number;
  skippedCount: number;
}

export { type ClassReport };

const downloadPDFFromStorage = async (pdfUrl: string): Promise<Blob | null> => {
  try {
    if (DEBUG) console.log('[zip] downloadPDFFromStorage:fetch', { pdfUrl });
    const refreshed = await refreshDownloadURL(pdfUrl);
    if (!refreshed) {
      throw new Error('Failed to refresh PDF URL - file may not exist');
    }
    const res = await fetch(refreshed, { method: 'GET' });
    if (!res.ok) {
      if (DEBUG) console.warn('[zip] downloadPDFFromStorage:http', { status: res.status, url: refreshed });
      throw new Error('Failed to fetch PDF');
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) {
      if (DEBUG) console.warn('[zip] downloadPDFFromStorage:empty', { url: refreshed });
      throw new Error('Empty PDF');
    }
    const type = blob.type || res.headers.get('Content-Type') || '';
    if (!type.includes('pdf') && type !== '') {
      if (DEBUG) console.warn('[zip] downloadPDFFromStorage:not-pdf', { type });
      throw new Error('Not a PDF');
    }
    if (DEBUG) console.log('[zip] downloadPDFFromStorage:ok', { size: blob.size });
    return blob;
  } catch {
    return null;
  }
};

const downloadZIP = (zipBlob: Blob, filename: string) => {
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(zipBlob),
    download: filename
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

export const downloadClassAsZIP = async (
  reports: ReportData[],
  className: string,
  students: Student[],
  teacher: Teacher
): Promise<number> => {
  const JSZip = await getJSZip();
  const zip = new JSZip();
  const folder = zip.folder(className);
  if (!folder) throw new Error('Failed to create ZIP folder');
  let successCount = 0;
  for (const report of reports) {
    try {
      const student = students.find(s => s.id === report.studentId);
      if (!student || !isReportReadyForPDF(report)) {
        if (DEBUG) console.warn('[zip] skip: not ready', { reportId: report.id });
        continue;
      }
      // Safely format date with fallback
      const safeDate = (() => {
        try {
          const date = toDate(report.createdAt);
          const formatted = date.toLocaleDateString('en-GB');
          if (formatted === 'Invalid Date') return new Date().toLocaleDateString('en-GB');
          return formatted;
        } catch {
          return new Date().toLocaleDateString('en-GB');
        }
      })();
      
      const pdfBlob = await generatePDFBlob({
        studentName: `${student.firstName} ${student.lastName}`,
        classLevel: className,
        classLocation: 'Unknown Location',
        comments: report.reportText || '',
        teacher: `${teacher.firstName} ${teacher.lastName}`,
        date: safeDate,
        artwork: report.artworkUrl || ''
      });
      if (pdfBlob?.size) {
        const dateStr = toDate(report.createdAt).toISOString().split('T')[0];
        folder.file(`${student.firstName}_${student.lastName}_${dateStr}.pdf`, pdfBlob);
        successCount++;
        if (DEBUG) console.log('[zip] on-demand:add', { student: student.id, size: pdfBlob.size });
      }
    } catch (error) {
      console.error(`Error processing report for ${report.studentId}:`, error);
    }
  }
  if (successCount === 0) throw new Error('No valid reports to download');
  downloadZIP(await zip.generateAsync({ type: 'blob' }), `${className}_reports.zip`);
  return successCount;
};

export const generateClassZIP = async (
  reports: ClassReport[],
  className: string,
  teacherName: string
): Promise<ZIPGenerationResult> => {
  const JSZip = await getJSZip();
  const zip = new JSZip();
  const folder = zip.folder(`${teacherName}_${className}`);
  if (!folder) throw new Error('Failed to create ZIP folder');
  let successCount = 0;
  let skippedCount = 0;
  for (const report of reports) {
    try {
      const hasText = report.comments?.trim();
      const hasImage = report.artwork?.trim();
      if (!hasText || !hasImage) {
        if (DEBUG) console.warn('[zip] skip: incomplete', { student: report.studentName, hasText: !!hasText, hasImage: !!hasImage });
        skippedCount++;
        continue;
      }
      if (hasImage) {
        try {
          const refreshed = await refreshDownloadURL(report.artwork!);
          if (!refreshed) {
            console.warn('Could not refresh artwork URL for report');
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('object-not-found')) {
            skippedCount++;
            continue;
          }
          throw error;
        }
      }
      if (!report.pdfUrl) {
        if (DEBUG) console.warn('[zip] skip: no pdfUrl', { student: report.studentName, date: report.date, teacher: report.teacher });
        skippedCount++;
        continue;
      }
      if (DEBUG) console.log('[zip] using-pre-generated-pdf', { 
        student: report.studentName, 
        date: report.date, 
        teacher: report.teacher,
        pdfUrl: report.pdfUrl.substring(0, 100) + '...'
      });
      const pdfBlob = await downloadPDFFromStorage(report.pdfUrl);
      if (pdfBlob?.size) {
        folder.file(`${report.studentName.replace(/\s+/g, '_')}_${report.date.replace(/\//g, '-')}.pdf`, pdfBlob);
        successCount++;
        if (DEBUG) console.log('[zip] prepared:add', { student: report.studentName, size: pdfBlob.size });
      } else {
        if (DEBUG) console.warn('[zip] skip: failed download or empty pdf', { student: report.studentName, pdfUrl: report.pdfUrl });
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error processing report for ${report.studentName}:`, error);
      skippedCount++;
    }
  }
  if (successCount === 0) throw new Error('No valid reports to download');
  downloadZIP(await zip.generateAsync({ type: 'blob' }), `${teacherName}_${className}_reports.zip`);
  if (DEBUG) console.log('[zip] done', { successCount, skippedCount });
  return { successCount, skippedCount };
};
