import type { ReportData, Student, Class, Teacher } from '@/types';
import { refreshDownloadURL } from './storageService';
import { getStorageInstance } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const isReportReadyForPDF = (report: ReportData): boolean =>
  !!(report.artworkUrl?.trim() && report.reportText?.trim());

const getFunctionUrl = (): string => {
  if (typeof window === 'undefined') return 'https://nsastudentreports.netlify.app/.netlify/functions/svg2pdf';
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8888/.netlify/functions/svg2pdf';
  if (hostname === 'development--nsastudentreports.netlify.app') return `${window.location.origin}/.netlify/functions/svg2pdf`;
  return 'https://nsastudentreports.netlify.app/.netlify/functions/svg2pdf';
};

const wrapText = (text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  let currentLine = '';
  for (const word of text.split(/\s+/)) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length * 7 > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else currentLine = testLine;
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
};

const tryAlternateArtworkPath = async (url: string): Promise<string> => {
  // Swap folder segment students <-> student and retry
  const swapped = url
    .replace(/\/students\//, '/student/')
    .replace(/%2Fstudents%2F/g, '%2Fstudent%2F');
  if (swapped !== url) return await refreshDownloadURL(swapped);
  const swappedBack = url
    .replace(/\/student\//, '/students/')
    .replace(/%2Fstudent%2F/g, '%2Fstudents%2F');
  if (swappedBack !== url) return await refreshDownloadURL(swappedBack);
  throw new Error('Alternate artwork path not applicable');
};

const convertArtworkToDataUrl = async (artworkUrl: string): Promise<string> => {
  let freshUrl: string;
  try {
    freshUrl = await refreshDownloadURL(artworkUrl);
  } catch (e: any) {
    if (e?.message?.includes('object-not-found')) {
      freshUrl = await tryAlternateArtworkPath(artworkUrl);
    } else {
      throw new Error(`Failed to refresh download URL: ${e?.message || 'unknown error'}`);
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          resolve(freshUrl);
        }
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error(`Artwork image could not be loaded: ${freshUrl.substring(0, 100)}...`));
    img.src = freshUrl;
  });
};

const generateSVGFromReport = async (
  report: ReportData,
  student: Student,
  classData: Class,
  teacher: Teacher
): Promise<string> => {
  const reportTemplateSvg = (await import('@/assets/report-template.svg?raw')).default;
  const svgDoc = new DOMParser().parseFromString(reportTemplateSvg, 'image/svg+xml');
  const svgClone = svgDoc.documentElement.cloneNode(true) as SVGElement;
  
  const studentName = `${student.firstName} ${student.lastName}`;
  const teacherName = `${teacher.firstName} ${teacher.lastName}`;
  const date = new Date(report.createdAt).toLocaleDateString('en-GB');
  const textMap: Record<string, string> = {
    '1': studentName,
    '2': classData.classLevel,
    '3': classData.classLocation,
    '4': wrapText(report.reportText?.trim() || '', 350).join('\n'),
    '5': teacherName,
    '6': date
  };
  
  svgClone.querySelectorAll('text tspan').forEach((tspan) => {
    const textContent = tspan.textContent;
    if (textContent && textMap[textContent]) tspan.textContent = textMap[textContent];
  });
  
  if (report.artworkUrl?.trim()) {
    try {
      const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
      Object.entries({ href: await convertArtworkToDataUrl(report.artworkUrl), x: '97.64', y: '308.45', width: '400', height: '250', preserveAspectRatio: 'xMidYMid meet' }).forEach(([k, v]) => imageElement.setAttribute(k, v));
      svgClone.appendChild(imageElement);
    } catch (error) {
      throw new Error(`Failed to load artwork: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return new XMLSerializer().serializeToString(svgClone);
};

const generatePDFBlob = async (svgString: string): Promise<Blob> => {
  const response = await fetch(getFunctionUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ svg: svgString, textData: {} })
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      throw new Error(JSON.parse(errorText).details || JSON.parse(errorText).error || `PDF generation failed: ${response.status}`);
    } catch {
      throw new Error(errorText || `PDF generation failed: ${response.status}`);
    }
  }
  const contentType = response.headers.get('Content-Type');
  if (contentType && !contentType.includes('application/pdf')) {
    const errorText = await response.text();
    try {
      throw new Error(JSON.parse(errorText).details || JSON.parse(errorText).error || 'PDF generation failed: Invalid response type');
    } catch {
      throw new Error(`PDF generation failed: Expected PDF, got ${contentType}`);
    }
  }

  const pdfBlob = await response.blob();
  if (pdfBlob.size === 0) throw new Error('PDF generation failed: Generated PDF is empty');
  return pdfBlob;
};

const safePathSegment = (value: string): string =>
  value
    .replace(/[\n\r\t]/g, ' ')
    .replace(/\//g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const uploadPDFToStorage = async (
  pdfBlob: Blob,
  _reportId: string,
  student: Student,
  classData: Class
): Promise<string> => {
  const file = new File([pdfBlob], 'report.pdf', { type: 'application/pdf' });
  const studentName = safePathSegment(
    `${student.firstName}${student.lastName ? ' ' + student.lastName : ''}`
  );
  const classDay = safePathSegment(classData.classDay || 'Unknown');
  const basePath = `student-reports/student/${studentName}-${classDay}`;
  const storageRef = ref(getStorageInstance(), `${basePath}/report.pdf`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const deletePDFFromStorage = async (pdfUrl: string): Promise<void> => {
  try {
    const path = decodeURIComponent(new URL(pdfUrl).pathname.split('/o/')[1]?.split('?')[0] || '');
    if (!path) throw new Error('Invalid storage URL');
    const { deleteObject } = await import('firebase/storage');
    await deleteObject(ref(getStorageInstance(), path));
  } catch (error: any) {
    if (error?.code !== 'storage/object-not-found') console.error('Error deleting PDF:', error);
  }
};

export const generateAndStorePDF = async (
  report: ReportData,
  student: Student,
  classData: Class,
  teacher: Teacher
): Promise<string> => {
  if (!isReportReadyForPDF(report)) throw new Error('Report does not meet PDF generation criteria: must have both image and text');
  return uploadPDFToStorage(
    await generatePDFBlob(await generateSVGFromReport(report, student, classData, teacher)),
    report.id,
    student,
    classData
  );
};

const updateReportPDFUrl = async (reportId: string, pdfUrl: string | undefined): Promise<void> => {
  await (await import('./firebaseService-ultra-final')).updateReport(reportId, { pdfUrl });
};

export const generatePDFInBackground = async (
  report: ReportData,
  student: Student,
  classData: Class,
  teacher: Teacher
): Promise<void> => {
  if (!isReportReadyForPDF(report)) {
    if (report.pdfUrl) {
      try {
        await deletePDFFromStorage(report.pdfUrl);
        await updateReportPDFUrl(report.id, undefined);
      } catch (error) {
        console.error(`Failed to clean up old PDF for report ${report.id}:`, error);
      }
    }
    return;
  }

  if (report.pdfUrl) {
    try {
      await deletePDFFromStorage(report.pdfUrl);
    } catch (error) {
      console.warn(`Failed to delete old PDF for report ${report.id}, continuing:`, error);
    }
  }

  generateAndStorePDF(report, student, classData, teacher)
    .then(async (pdfUrl) => {
      try {
        await updateReportPDFUrl(report.id, pdfUrl);
        console.log(`PDF generated and stored for report ${report.id}:`, pdfUrl);
      } catch (error) {
        console.error(`Failed to update report ${report.id} with PDF URL:`, error);
      }
    })
    .catch((error) => {
      console.error(`Failed to generate PDF for report ${report.id}:`, error);
      if (report.pdfUrl) updateReportPDFUrl(report.id, undefined).catch((err: unknown) => console.error(`Failed to clear pdfUrl for report ${report.id}:`, err));
    });
};
