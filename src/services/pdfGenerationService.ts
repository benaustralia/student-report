import type { ReportData, Student, Class, Teacher } from '@/types';
import { refreshDownloadURL, toPublicURL, buildStudentFolderName } from './storageService';
import { updateReport } from './firebaseService-ultra-final';
// Firebase Storage is lazy-loaded - don't import here

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
  if (DEBUG) console.log('[pdf] wrapText:start', { textLength: text.length, maxWidth, preview: text.substring(0, 50) });
  const lines: string[] = [];
  let currentLine = '';
  
  // Split by whitespace but preserve whitespace for proper spacing
  const parts = text.split(/(\s+)/);
  if (DEBUG) console.log('[pdf] wrapText:parts', { partCount: parts.length, firstParts: parts.slice(0, 5) });
  
  for (const part of parts) {
    if (!part) continue;
    
    // If this is whitespace, just add it to current line
    if (/^\s+$/.test(part)) {
      currentLine += part;
      continue;
    }
    
    // Check if this part contains Chinese characters
    const hasChinese = /[\u4e00-\u9fff]/.test(part);
    
    if (hasChinese) {
      // Handle Chinese character-by-character
      for (let i = 0; i < part.length; i++) {
        const char = part[i];
        const testLine = currentLine + char;
        // Chinese characters are wider: estimate ~11px per Chinese char, ~7px per English
        const estimatedWidth = testLine.split('').reduce((sum, c) => {
          return sum + (/[\u4e00-\u9fff]/.test(c) ? 11 : 7);
        }, 0);
        
        if (estimatedWidth > maxWidth && currentLine) {
          if (DEBUG) console.log('[pdf] wrapText:wrap-chinese', { estimatedWidth, maxWidth, char });
          lines.push(currentLine.trim());
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
    } else {
      // Handle English/space-separated text
      const testLine = currentLine ? `${currentLine}${part}` : part;
      // Use smaller estimate for English to allow wider lines before wrapping
      const estimatedWidth = testLine.length * 5.5;
      
      if (estimatedWidth > maxWidth && currentLine) {
        if (DEBUG) console.log('[pdf] wrapText:wrap-english', { estimatedWidth, maxWidth });
        lines.push(currentLine.trim());
        currentLine = part;
      } else {
        currentLine = testLine;
      }
    }
  }
  
  if (currentLine.trim()) lines.push(currentLine.trim());
  if (DEBUG) console.log('[pdf] wrapText:result', { lineCount: lines.length, lineLengths: lines.map(l => l.length) });
  return lines.length > 0 ? lines : [''];
};

const tryAlternateArtworkPath = async (url: string): Promise<string> => {
  // Swap folder segment students <-> student and retry
  const swapped = url
    .replace(/\/students\//, '/student/')
    .replace(/%2Fstudents%2F/g, '%2Fstudent%2F');
  if (swapped !== url) {
    const result = await refreshDownloadURL(swapped);
    if (result) return result;
  }
  const swappedBack = url
    .replace(/\/student\//, '/students/')
    .replace(/%2Fstudent%2F/g, '%2Fstudents%2F');
  if (swappedBack !== url) {
    const result = await refreshDownloadURL(swappedBack);
    if (result) return result;
  }
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
  
  // Safely format date with validation (same logic as ClassCard.tsx)
  const date = (() => {
    const timestamp = report.createdAt;
    let dateObj: Date | null = null;
    
    try {
      if (timestamp && typeof timestamp === 'object') {
        // Firestore timestamp with seconds property
        if ('seconds' in timestamp) {
          dateObj = new Date((timestamp as { seconds: number }).seconds * 1000);
        }
        // Firestore Timestamp object with toDate method
        else if ('toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function') {
          dateObj = (timestamp as { toDate: () => Date }).toDate();
        }
      }
      // If it's already a Date object
      else if (timestamp && typeof timestamp === 'object' && 'getTime' in timestamp && typeof (timestamp as any).getTime === 'function') {
        dateObj = timestamp as Date;
      }
      // Fallback: try to convert
      else if (timestamp) {
        dateObj = new Date(timestamp as string | number);
      }
      
      // Validate the date and format it
      if (dateObj && !isNaN(dateObj.getTime())) {
        const formatted = dateObj.toLocaleDateString('en-GB');
        // Double-check the formatted string isn't "Invalid Date"
        if (formatted && formatted !== 'Invalid Date' && formatted !== 'NaN/NaN/NaN') {
          if (DEBUG) console.log('[pdf] date:formatted-success', { reportId: report.id, formatted });
          return formatted;
        }
      }
    } catch (error) {
      if (DEBUG) console.warn('[pdf] date-format-error', { reportId: report.id, timestamp, error });
    }
    
    // Fallback to current date if all else fails
    const fallback = new Date().toLocaleDateString('en-GB');
    if (DEBUG) console.warn('[pdf] date:using-fallback', { reportId: report.id, fallback, originalTimestamp: timestamp });
    return fallback;
  })();
  // Remove template placeholders to prevent overlay issues
  svgClone.querySelectorAll('text.st1, text.st2').forEach((t) => {
    if (t.textContent && /^[123456]$/.test(t.textContent.trim())) t.remove();
  });
  const create = (tag: string, attrs: Record<string, string> = {}) => {
    const el = svgDoc.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const addText = (x: number, y: number, text: string, size = '13px') => {
    const el = create('text', {
      transform: `translate(${x} ${y})`,
      'font-family': 'Noto Sans SC',
      fill: 'black',
      'font-size': size
    });
    el.textContent = text;
    svgClone.appendChild(el);
  };
  // Header/meta
  ([
    [206.17, 222.41, studentName],
    [206.17, 250.43, classData.classLevel],
    [206.44, 278.45, classData.classLocation],
    [327.71, 727.44, teacherName],
    [327.71, 745.52, date]
  ] as [number, number, string][]).forEach(([x, y, t]) => addText(x, y, t));
  // Report body
  const lines = wrapText(report.reportText?.trim() || '', 350);
  lines.forEach((line, i) => addText(179.27, 590.33 + i * 16, line, '11px'));
  if (DEBUG) console.log('[pdf] generateSVGFromReport:text-added', { lines: lines.length });

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

// kept for historical reference but no longer used (folder building centralized)

const uploadPDFToStorage = async (
  pdfBlob: Blob,
  _reportId: string,
  student: Student,
  classData: Class
): Promise<string> => {
  const folder = buildStudentFolderName(
    student.firstName,
    student.lastName,
    classData.classDay
  );
  const basePath = `student-reports/students/${folder}`;
  const fileName = `${folder}.pdf`;
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
  // Lazy load Firebase Storage only when needed
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const { getStorageInstance } = await import('../config/firebaseStorage');
  const storage = await getStorageInstance();
  const storageRef = ref(storage, `${basePath}/${fileName}`);
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
    // Lazy load Firebase Storage only when needed
    const { ref, deleteObject } = await import('firebase/storage');
    const { getStorageInstance } = await import('../config/firebaseStorage');
    const storage = await getStorageInstance();
    await deleteObject(ref(storage, path));
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
  await updateReport(reportId, { pdfUrl });
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
