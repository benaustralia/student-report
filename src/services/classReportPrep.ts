import { isReportReadyForPDF, generatePDFInBackground } from '@/services/pdfGenerationService';
import { getReportsForClass, getTeacherByEmail } from '@/services/firebaseService-ultra-final';
import type { Class, ReportData, Student, Teacher } from '@/types';
import { refreshDownloadURL } from '@/services/storageService';

async function checkPdfExists(pdfUrl?: string): Promise<boolean> {
  if (!pdfUrl) return false;
  try {
    const url = await refreshDownloadURL(pdfUrl);
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch { return false; }
}

export interface PrepCounts { total: number; prepared: number; toPrepare: number; }

export async function prepareMissingPdfsForClass(classData: Class, students: Student[], debug = false): Promise<PrepCounts> {
  const [reports, teacher] = await Promise.all([
    getReportsForClass(classData.id),
    getTeacherByEmail(classData.teacherEmail).catch(() => null)
  ]);
  const effectiveTeacher: Teacher | null = teacher || null;
  const existence = await Promise.all(reports.map(r => checkPdfExists(r.pdfUrl)));
  const total = reports.length;
  const prepared = existence.filter(Boolean).length;
  const toPrepare = reports.filter((r, i) => !existence[i] && isReportReadyForPDF(r)).length;
  if (debug) console.log('[class] counts', { total, prepared, toPrepare });
  await Promise.all(reports.map(async (r, i) => {
    if (r.pdfUrl && !existence[i]) {
      // stale - ignore clearing here to avoid write bursts
    }
  }));
  for (const r of reports) {
    if (isReportReadyForPDF(r) && !r.pdfUrl) {
      const student = students.find(s => s.id === r.studentId);
      if (student && effectiveTeacher) {
        generatePDFInBackground(r, student, classData, effectiveTeacher);
      }
    }
  }
  return { total, prepared, toPrepare };
}
