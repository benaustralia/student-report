import type { ReportData, Student, Teacher } from '@/types';
import { refreshDownloadURL } from './storageService';
import { isReportReadyForPDF } from './pdfGenerationService';
import { generatePDFBlob, type ClassReport } from './zipPDFGenerator';

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
    const r = await fetch(await refreshDownloadURL(pdfUrl));
    if (!r.ok || (await r.blob()).size === 0) throw new Error('Invalid PDF');
    return await r.blob();
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
  const folder = (await getJSZip()).folder(className);
  if (!folder) throw new Error('Failed to create ZIP folder');
  let successCount = 0;
  for (const report of reports) {
    try {
      const student = students.find(s => s.id === report.studentId);
      if (!student || !isReportReadyForPDF(report)) continue;
      const pdfBlob = await generatePDFBlob({
        studentName: `${student.firstName} ${student.lastName}`,
        classLevel: className,
        classLocation: 'Unknown Location',
        comments: report.reportText || '',
        teacher: `${teacher.firstName} ${teacher.lastName}`,
        date: toDate(report.createdAt).toLocaleDateString('en-GB'),
        artwork: report.artworkUrl || ''
      });
      if (pdfBlob?.size) {
        const dateStr = toDate(report.createdAt).toISOString().split('T')[0];
        folder.file(`${student.firstName}_${student.lastName}_${dateStr}.pdf`, pdfBlob);
        successCount++;
      }
    } catch (error) {
      console.error(`Error processing report for ${report.studentId}:`, error);
    }
  }
  if (successCount === 0) throw new Error('No valid reports to download');
  downloadZIP(await folder.generateAsync({ type: 'blob' }), `${className}_reports.zip`);
  return successCount;
};

export const generateClassZIP = async (
  reports: ClassReport[],
  className: string,
  teacherName: string
): Promise<ZIPGenerationResult> => {
  const folder = (await getJSZip()).folder(`${teacherName}_${className}`);
  if (!folder) throw new Error('Failed to create ZIP folder');
  let successCount = 0;
  let skippedCount = 0;
  for (const report of reports) {
    try {
      const hasText = report.comments?.trim();
      const hasImage = report.artwork?.trim();
      if (!hasText || !hasImage) {
        skippedCount++;
        continue;
      }
      if (hasImage) {
        try {
          await refreshDownloadURL(report.artwork!);
        } catch (error) {
          if (error instanceof Error && error.message.includes('object-not-found')) {
            skippedCount++;
            continue;
          }
          throw error;
        }
      }
      const pdfBlob = report.pdfUrl ? await downloadPDFFromStorage(report.pdfUrl) : null;
      const finalPdfBlob = pdfBlob || await generatePDFBlob(report);
      if (finalPdfBlob?.size) {
        folder.file(`${report.studentName.replace(/\s+/g, '_')}_${report.date.replace(/\//g, '-')}.pdf`, finalPdfBlob);
        successCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error processing report for ${report.studentName}:`, error);
      skippedCount++;
    }
  }
  if (successCount === 0) throw new Error('No valid reports to download');
  downloadZIP(await folder.generateAsync({ type: 'blob' }), `${teacherName}_${className}_reports.zip`);
  return { successCount, skippedCount };
};
