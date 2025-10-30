import nsalogoPng from '@/assets/NSALogo.png?url';
import { wrapTextWithNotoSans } from '@/services/textWrap';
import { convertUrlToDataUrl } from '@/services/image';

export type ReportTextWrap = (text: string, maxPixelWidth: number) => string[];

export async function fetchSvgTemplate(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch SVG template: ${response.status}`);
  return await response.text();
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
