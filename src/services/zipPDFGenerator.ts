import { refreshDownloadURL } from './storageService';

const DEBUG = true;

export interface ClassReport {
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date: string;
  artwork?: string;
  pdfUrl?: string;
}

const getFunctionUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'https://nsastudentreports.netlify.app/.netlify/functions/svg2pdf';
  }
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8888/.netlify/functions/svg2pdf';
  }
  if (hostname === 'development--nsastudentreports.netlify.app') {
    return `${window.location.origin}/.netlify/functions/svg2pdf`;
  }
  return 'https://nsastudentreports.netlify.app/.netlify/functions/svg2pdf';
};

const convertArtworkToDataUrl = async (url: string): Promise<string> => {
  const freshUrl = await refreshDownloadURL(url);
  if (DEBUG) console.log('[zip-gen] artwork:refreshed', { url: freshUrl });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          resolve(freshUrl);
        }
      } catch {
        reject(new Error('Canvas conversion failed'));
      }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = freshUrl;
  });
};

const createSVGElement = (doc: Document, tag: string, attrs: Record<string, string> = {}) => {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

const wrapText = (text: string, maxWidth: number): string[] => {
  // Use the exact same simple approach that works perfectly for individual PDFs
  // This handles both English and Chinese text correctly
  const lines: string[] = [];
  let currentLine = '';
  
  // Split by whitespace to handle both English words and Chinese character blocks
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    // Use the same 7px-per-character estimate that works for individual PDFs
    // This works for both English and Chinese characters in the Noto Sans SC font
    if (testLine.length * 7 > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
};

const addText = (doc: Document, svg: SVGSVGElement, x: number, y: number, text: string, size = '13px') => {
  const el = createSVGElement(doc, 'text', {
    transform: `translate(${x} ${y})`,
    'font-family': 'Noto Sans SC',
    fill: 'black',
    'font-size': size
  });
  el.textContent = String(text);
  svg.appendChild(el);
};

export const generatePDFBlob = async (reportData: ClassReport): Promise<Blob> => {
  const templateSvg = (await import('@/assets/report-template.svg?raw')).default;
  const svgDoc = new DOMParser().parseFromString(templateSvg, 'image/svg+xml');
  const svgClone = svgDoc.querySelector('svg')?.cloneNode(true) as SVGSVGElement;
  if (!svgClone) throw new Error('Could not parse SVG template');
  if (DEBUG) console.log('[zip-gen] start', { student: reportData.studentName });
  svgClone.querySelectorAll('text.st1, text.st2').forEach(t => {
    if (t.textContent && /^[123456]$/.test(t.textContent.trim())) t.remove();
  });
  // Validate and format date - ensure it's not "Invalid Date"
  const formattedDate = (() => {
    if (!reportData.date) {
      if (DEBUG) console.warn('[zip-gen] date:missing', { student: reportData.studentName });
      return new Date().toLocaleDateString('en-GB');
    }
    
    // Check for invalid date strings
    const dateStr = String(reportData.date);
    if (dateStr === 'Invalid Date' || dateStr === 'NaN/NaN/NaN' || dateStr.includes('Invalid')) {
      if (DEBUG) console.warn('[zip-gen] date:invalid-string', { student: reportData.studentName, date: dateStr });
      return new Date().toLocaleDateString('en-GB');
    }
    
    // If it's already a properly formatted string (DD/MM/YYYY), use it
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
      return dateStr;
    }
    
    // Try to parse and reformat
    try {
      const parsed = new Date(reportData.date);
      if (!isNaN(parsed.getTime())) {
        const formatted = parsed.toLocaleDateString('en-GB');
        // Double-check the formatted result
        if (formatted && formatted !== 'Invalid Date' && formatted !== 'NaN/NaN/NaN') {
          return formatted;
        }
      }
    } catch (error) {
      if (DEBUG) console.warn('[zip-gen] date:parse-error', { student: reportData.studentName, date: reportData.date, error });
    }
    
    if (DEBUG) console.warn('[zip-gen] date:fallback', { student: reportData.studentName, original: reportData.date });
    return new Date().toLocaleDateString('en-GB');
  })();
  
  ([
    [206.17, 222.41, reportData.studentName],
    [206.17, 250.43, reportData.classLevel],
    [206.44, 278.45, reportData.classLocation],
    [327.71, 727.44, reportData.teacher],
    [327.71, 745.52, formattedDate]
  ] as [number, number, string][]).forEach(([x, y, t]) => {
    addText(svgDoc, svgClone, x, y, t);
  });
  if (reportData.comments?.trim()) {
    wrapText(reportData.comments.trim(), 350).forEach((line, i) => {
      addText(svgDoc, svgClone, 179.27, 590.33 + i * 16, line.trim(), '11px');
    });
    if (DEBUG) console.log('[zip-gen] text-lines', { count: wrapText(reportData.comments.trim(), 350).length });
  }
  if (reportData.artwork?.trim()) {
    try {
      const imgEl = createSVGElement(svgDoc, 'image', {
        x: '97.64',
        y: '308.45',
        width: '400',
        height: '250',
        preserveAspectRatio: 'xMidYMid meet'
      });
      imgEl.setAttribute('href', await convertArtworkToDataUrl(reportData.artwork));
      svgClone.appendChild(imgEl);
    } catch (error) {
      throw new Error(`Failed to load artwork: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  // Only update non-comment tspan elements (comments are already added as separate text elements above)
  const textMap = {
    '1': reportData.studentName,
    '2': reportData.classLevel,
    '3': reportData.classLocation,
    '5': reportData.teacher,
    '6': formattedDate
  };
  svgClone.querySelectorAll('text tspan').forEach(t => {
    const token = t.textContent?.trim();
    // Skip token '4' (comments) since we already added it as separate text elements with proper wrapping
    if (token && token !== '4' && textMap[token as keyof typeof textMap]) {
      t.textContent = textMap[token as keyof typeof textMap];
    }
  });
  Object.entries({
    width: '595.28',
    height: '841.89',
    viewBox: '0 0 595.28 841.89',
    xmlns: 'http://www.w3.org/2000/svg',
    'xmlns:xlink': 'http://www.w3.org/1999/xlink'
  }).forEach(([k, v]) => svgClone.setAttribute(k, v));
  const styleEl = createSVGElement(svgDoc, 'style');
  styleEl.textContent = `text { fill: black !important; fill-opacity: 1 !important; opacity: 1 !important; color: black !important; font-family: 'Noto Sans SC', Arial, sans-serif !important; font-weight: normal !important; font-size: 11px !important; } .st1, .st2 { fill: transparent !important; fill-opacity: 0 !important; opacity: 0 !important; } .st5 { fill: black !important; fill-opacity: 1 !important; opacity: 1 !important; }`;
  svgClone.appendChild(styleEl);
  const fnUrl = getFunctionUrl();
  if (DEBUG) console.log('[zip-gen] fetch-fn', { fnUrl });
  const response = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      svg: new XMLSerializer().serializeToString(svgClone),
      textData: {}
    })
  });
  if (DEBUG) console.log('[zip-gen] fn-status', { status: response.status });
  if (!response.ok) {
    const errorText = (await response.text()).substring(0, 200);
    throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
  }
  const pdfBlob = await response.blob();
  if (pdfBlob.type !== 'application/pdf') {
    const errorText = (await pdfBlob.text()).substring(0, 200);
    throw new Error(`Server returned non-PDF: ${pdfBlob.type}. Response: ${errorText}`);
  }
  if (pdfBlob.size === 0) throw new Error('Generated PDF blob is empty');
  return pdfBlob;
};


