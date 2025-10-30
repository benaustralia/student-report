import type { ReportData, Student, Class, Teacher } from '@/types';
import { refreshDownloadURL, toPublicURL } from './storageService';
import { getStorageInstance } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const DEBUG = true; // flip to false to silence logs

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
  if (DEBUG) console.log('[pdf] convertArtworkToDataUrl:start', { artworkUrl });
  let freshUrl: string;
  try {
    // Prefer public URL to avoid auth/CORS
    freshUrl = toPublicURL(artworkUrl);
    if (DEBUG) console.log('[pdf] convertArtworkToDataUrl:refreshed', { freshUrl });
  } catch (e: any) {
    if (e?.message?.includes('object-not-found')) {
      if (DEBUG) console.warn('[pdf] convertArtworkToDataUrl:missing-original, try alternate');
      freshUrl = toPublicURL(await tryAlternateArtworkPath(artworkUrl));
      if (DEBUG) console.log('[pdf] convertArtworkToDataUrl:alternate-refreshed', { freshUrl });
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          if (DEBUG) console.log('[pdf] convertArtworkToDataUrl:canvas-dataurl');
          resolve(dataUrl);
        } catch {
          if (DEBUG) console.warn('[pdf] convertArtworkToDataUrl:canvas-fallback-url');
          resolve(freshUrl);
        }
      } catch (error) {
        if (DEBUG) console.error('[pdf] convertArtworkToDataUrl:img-onload-error', error);
        reject(error);
      }
    };
    img.onerror = () => {
      if (DEBUG) console.error('[pdf] convertArtworkToDataUrl:img-onerror', freshUrl);
      reject(new Error(`Artwork image could not be loaded: ${freshUrl.substring(0, 100)}...`));
    };
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
  if (DEBUG) console.log('[pdf] generateSVGFromReport:start', { reportId: report.id });
  // Preserve whitespace so \n breaks are honored when using tspans
  svgClone.setAttribute('xml:space', 'preserve');
  
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
  
  let replacedCount = 0;
  const tspans = Array.from(svgClone.querySelectorAll('text tspan'));
  tspans.forEach((tspan) => {
    const token = tspan.textContent || '';
    const value = textMap[token];
    if (!value) return;
    // Special handling for multi-line report body (token '4')
    if (token === '4' && value.includes('\n')) {
      const parentText = tspan.parentElement as SVGTextElement | null;
      if (parentText) {
        // Clear original content and add tspans per line
        while (parentText.firstChild) parentText.removeChild(parentText.firstChild);
        const lines = value.split(/\n+/);
        lines.forEach((line, idx) => {
          const lineTspan = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          if (idx === 0) {
            lineTspan.setAttribute('x', parentText.getAttribute('x') || tspan.getAttribute('x') || '');
            lineTspan.setAttribute('y', parentText.getAttribute('y') || tspan.getAttribute('y') || '');
          } else {
            lineTspan.setAttribute('x', parentText.getAttribute('x') || tspan.getAttribute('x') || '');
            lineTspan.setAttribute('dy', '1.2em');
          }
          lineTspan.textContent = line;
          parentText.appendChild(lineTspan);
        });
        replacedCount++;
        return;
      }
    }
    tspan.textContent = value;
    replacedCount++;
  });
  if (DEBUG) console.log('[pdf] generateSVGFromReport:text-replaced', { replacedCount });

  // Force visible black text to avoid template styles hiding content
  const styleEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = (
    "text { fill: black !important; fill-opacity: 1 !important; opacity: 1 !important; color: black !important;" +
    " font-family: 'Noto Sans SC', Arial, sans-serif !important; font-weight: normal !important; font-size: 11px !important; } " +
    ".st1, .st2 { fill: transparent !important; fill-opacity: 0 !important; opacity: 0 !important; } " +
    ".st5 { fill: black !important; fill-opacity: 1 !important; opacity: 1 !important; }"
  );
  svgClone.appendChild(styleEl);
  
  if (report.artworkUrl?.trim()) {
    try {
      const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
      Object.entries({ href: await convertArtworkToDataUrl(report.artworkUrl), x: '97.64', y: '308.45', width: '400', height: '250', preserveAspectRatio: 'xMidYMid meet' }).forEach(([k, v]) => imageElement.setAttribute(k, v));
      svgClone.appendChild(imageElement);
    } catch (error) {
      if (DEBUG) console.error('[pdf] generateSVGFromReport:artwork-fail', error);
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
  if (DEBUG) console.log('[pdf] generatePDFBlob:netlify:status', response.status);

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
  if (pdfBlob.size === 0) {
    if (DEBUG) console.error('[pdf] generatePDFBlob:empty');
    throw new Error('PDF generation failed: Generated PDF is empty');
  }
  if (DEBUG) console.log('[pdf] generatePDFBlob:ok', { size: pdfBlob.size });
  return pdfBlob;
};

const safePathSegment = (value: string): string =>
  value
    .replace(/[\n\r\t]/g, ' ')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .trim();

const uploadPDFToStorage = async (
  pdfBlob: Blob,
  _reportId: string,
  student: Student,
  classData: Class
): Promise<string> => {
  const studentName = safePathSegment(
    `${student.firstName}${student.lastName ? ' ' + student.lastName : ''}`
  );
  const classDay = safePathSegment(classData.classDay || 'Unknown');
  const basePath = `student-reports/students/${studentName}-${classDay}`;
  const fileName = `${studentName}-${classDay}.pdf`;
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
  const storageRef = ref(getStorageInstance(), `${basePath}/${fileName}`);
  if (DEBUG) console.log('[pdf] uploadPDFToStorage:path', { basePath, fileName, reportId: _reportId });
  try {
    await uploadBytes(storageRef, file);
  } catch (e: any) {
    console.error('[pdf] uploadPDFToStorage:upload-error', {
      message: e?.message,
      code: e?.code
    });
    throw e;
  }
  let url: string;
  try {
    url = await getDownloadURL(storageRef);
  } catch (e: any) {
    console.error('[pdf] uploadPDFToStorage:url-error', {
      message: e?.message,
      code: e?.code
    });
    throw e;
  }
  if (DEBUG) console.log('[pdf] uploadPDFToStorage:url', url);
  return url;
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
  if (DEBUG) console.log('[pdf] generateAndStorePDF:start', { reportId: report.id });
  const url = await uploadPDFToStorage(
    await generatePDFBlob(await generateSVGFromReport(report, student, classData, teacher)),
    report.id,
    student,
    classData
  );
  if (DEBUG) console.log('[pdf] generateAndStorePDF:done', { reportId: report.id, url });
  return url;
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
        if (DEBUG) console.log('[pdf] bg:cleanup-old-pdf', { reportId: report.id });
      } catch (error) {
        console.error(`Failed to clean up old PDF for report ${report.id}:`, error);
      }
    }
    return;
  }

  if (report.pdfUrl) {
    try {
      await deletePDFFromStorage(report.pdfUrl);
      if (DEBUG) console.log('[pdf] bg:delete-existing', { reportId: report.id });
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
    .catch((error: any) => {
      console.error(`Failed to generate PDF for report ${report.id}:`, {
        message: error?.message,
        code: error?.code
      });
      if (report.pdfUrl) updateReportPDFUrl(report.id, undefined).catch((err: unknown) => console.error(`Failed to clear pdfUrl for report ${report.id}:`, err));
    });
};
