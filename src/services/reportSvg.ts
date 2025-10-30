import nsalogoPng from '@/assets/NSALogo.png?url';
import { refreshDownloadURL } from '@/services/storageService';

export type ReportTextWrap = (text: string, maxPixelWidth: number) => string[];

export function wrapTextWithNotoSans(text: string, maxPixelWidth: number): string[] {
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return [text];
  measureCtx.font = '11px "Noto Sans SC", Arial, sans-serif';
  if (measureCtx.measureText(text).width <= maxPixelWidth) return [text];
  return wrapTextByWidth(text, maxPixelWidth, measureCtx);
}

function wrapTextByWidth(text: string, maxPixelWidth: number, measureCtx: CanvasRenderingContext2D): string[] {
  const lines: string[] = [];
  let currentLine = '';
  const tokens = text.split(/(\s+|[。！？，、；：]|[.!?])/);
  for (const token of tokens) {
    if (!token) continue;
    const testLine = currentLine + token;
    const testWidth = measureCtx.measureText(testLine).width;
    if (testWidth > maxPixelWidth) {
      if (currentLine.length > 0) {
        const trimmedLine = currentLine.trim();
        const punctuationMarks = ['.', '。', '!', '！', '?', '？', ',', '，', ';', '；', ':', '：'];
        const endsWithPunctuation = punctuationMarks.some(mark => trimmedLine.endsWith(mark));
        if (endsWithPunctuation) {
          lines.push(currentLine.trim());
          currentLine = token;
        } else {
          lines.push(currentLine.trim());
          currentLine = token;
        }
      } else {
        if (measureCtx.measureText(token).width > maxPixelWidth) {
          let tempLine = '';
          for (const char of token) {
            const testCharLine = tempLine + char;
            if (measureCtx.measureText(testCharLine).width > maxPixelWidth) {
              if (tempLine.length > 0) {
                lines.push(tempLine);
                tempLine = char;
              } else {
                lines.push(char);
              }
            } else {
              tempLine += char;
            }
          }
          currentLine = tempLine;
        } else {
          currentLine = token;
        }
      }
    } else {
      currentLine += token;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine.trim());
  return lines;
}

export async function fetchSvgTemplate(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch SVG template: ${response.status}`);
  return await response.text();
}

export async function convertUrlToDataUrl(url: string): Promise<string> {
  let effectiveUrl = url;
  const isFirebase = effectiveUrl.includes('firebasestorage.googleapis.com');
  if (isFirebase) {
    try { effectiveUrl = await refreshDownloadURL(effectiveUrl); } catch {}
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!isFirebase) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl);
        } catch (e) {
          if (isFirebase) {
            // fallback for CORS-tainted firebase images
            resolve(effectiveUrl);
          } else {
            reject(e instanceof Error ? e : new Error('Failed to export canvas'));
          }
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Canvas conversion failed'));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${effectiveUrl}`));
    img.src = effectiveUrl;
  });
}

export interface ReportSvgData {
  studentName: string;
  classLevel: string;
  classLocation: string;
  teacherName: string;
  date: string;
  reportText?: string;
  artworkDataUrl?: string; // data URL or regular URL
}

export function injectReportIntoSvg(svgText: string, data: ReportSvgData, options?: { commentsX?: number; commentsY?: number; wrapWidth?: number; lineHeight?: number }): string {
  const { studentName, classLevel, classLocation, teacherName, date, reportText, artworkDataUrl } = data;
  const { commentsX = 179.27, commentsY = 590.33, wrapWidth = 350, lineHeight = 16 } = options || {};
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgElement = svgDoc.querySelector('svg');
  if (!svgElement) throw new Error('Could not parse SVG template');
  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  const addTextElement = (x: number, y: number, text: string) => {
    const t = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'st5');
    t.setAttribute('transform', `translate(${x} ${y})`);
    t.setAttribute('font-family', 'Noto Sans SC, Arial, sans-serif');
    t.setAttribute('font-size', '11px');
    t.setAttribute('fill', 'black');
    t.textContent = text;
    return t;
  };
  svgClone.querySelectorAll('text.st1, text.st2').forEach(text => {
    if (text.textContent && /^[123456]$/.test(text.textContent.trim())) text.remove();
  });
  svgClone.appendChild(addTextElement(206.17, 222.41, studentName));
  svgClone.appendChild(addTextElement(206.17, 250.43, classLevel));
  svgClone.appendChild(addTextElement(206.44, 278.45, classLocation));
  svgClone.appendChild(addTextElement(327.71, 727.44, teacherName));
  svgClone.appendChild(addTextElement(327.71, 745.52, date));
  if (reportText?.trim()) {
    const wrapped = wrapTextWithNotoSans(reportText, wrapWidth);
    wrapped.forEach((line, idx) => {
      const trimmed = line.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
      if (!trimmed) return;
      const t = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('class', 'st5');
      t.setAttribute('transform', `translate(${commentsX} ${commentsY + (idx * lineHeight)})`);
      t.setAttribute('font-family', 'Noto Sans SC, Arial, sans-serif');
      t.setAttribute('font-size', '11px');
      t.setAttribute('fill', 'black');
      t.textContent = trimmed;
      svgClone.appendChild(t);
    });
  }
  if (artworkDataUrl) {
    const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
    imageElement.setAttribute('href', artworkDataUrl);
    imageElement.setAttribute('x', '97.64');
    imageElement.setAttribute('y', '308.45');
    imageElement.setAttribute('width', '400');
    imageElement.setAttribute('height', '250');
    imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgClone.appendChild(imageElement);
  }
  const logoElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
  logoElement.setAttribute('href', nsalogoPng);
  logoElement.setAttribute('x', '55');
  logoElement.setAttribute('y', '680');
  logoElement.setAttribute('width', '80');
  logoElement.setAttribute('height', '80');
  logoElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgClone.appendChild(logoElement);
  const styleElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleElement.textContent = `
    text { fill: black !important; fill-opacity: 1 !important; opacity: 1 !important; color: black !important; font-family: 'Noto Sans SC', Arial, sans-serif !important; font-weight: normal !important; font-size: 11px !important; }
    .st1, .st2 { fill: transparent !important; fill-opacity: 0 !important; opacity: 0 !important; }
    .st5 { fill: black !important; fill-opacity: 1 !important; opacity: 1 !important; }
  `;
  svgClone.appendChild(styleElement);
  svgClone.setAttribute('width', '100%');
  svgClone.setAttribute('height', 'auto');
  svgClone.setAttribute('viewBox', '0 0 595.28 600');
  svgClone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return new XMLSerializer().serializeToString(svgClone);
}

export async function svgToPng(svgString: string, options?: { scale?: number }): Promise<string> {
  const scale = options?.scale ?? (300 / 72);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  canvas.width = 595 * scale; // A4 width
  canvas.height = 842 * scale; // A4 height
  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG as image'));
      img.src = svgUrl;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
