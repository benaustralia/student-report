import React, { useEffect, useRef, useState } from 'react';
import reportTemplateSvg from '@/assets/report-template.svg?url';
import nsalogoPng from '@/assets/NSALogo.png?url';

interface ReportTemplateProps { studentName: string; classLevel: string; classLocation: string; comments: string; teacher: string; date: string; artwork?: string; }

export const ReportTemplate: React.FC<ReportTemplateProps> = ({ studentName, classLevel, classLocation, comments, teacher, date, artwork }) => {
  const svgRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ processedSvg: '', isLoading: true });

  const convertUrlToDataUrl = async (url: string): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (error) { reject(error); }
    };
    img.onerror = () => reject(new Error(`Failed to load image from URL: ${url}. Please ensure CORS is configured for your Firebase Storage bucket.`));
    img.src = url;
  });

  const wrapText = (text: string, maxLength: number = 55): string[] => {
    if (text.length <= maxLength) return [text];
    
    // Check if text contains Chinese characters
    const hasChinese = /[\u4e00-\u9fff]/.test(text);
    
    if (hasChinese) {
      // For Chinese text, try to wrap at natural boundaries
      const lines: string[] = [];
      let currentLine = '';
      
      // Split text into segments by punctuation and spaces
      const segments = text.split(/([。！？，、；：\s]+)/);
      
      for (const segment of segments) {
        if (!segment) continue;
        
        // If adding this segment would exceed the limit
        if (currentLine.length + segment.length > maxLength) {
          if (currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = segment;
          } else {
            // If even a single segment is too long, break it character by character
            if (segment.length > maxLength) {
              let tempLine = '';
              for (const char of segment) {
                if (tempLine.length + 1 > maxLength) {
                  lines.push(tempLine);
                  tempLine = char;
                } else {
                  tempLine += char;
                }
              }
              currentLine = tempLine;
            } else {
              currentLine = segment;
            }
          }
        } else {
          currentLine += segment;
        }
      }
      
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      
      return lines;
    } else {
      // For English text, split by words
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        if (currentLine.length + word.length + 1 > maxLength) {
          if (currentLine.length > 0) { 
            lines.push(currentLine.trim()); 
            currentLine = word; 
          } else {
            lines.push(word);
          }
        } else {
          currentLine += (currentLine.length > 0 ? ' ' : '') + word;
        }
      }
      
      if (currentLine.length > 0) {
        lines.push(currentLine.trim());
      }
      
      return lines;
    }
  };

  useEffect(() => {
    const processSvgTemplate = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        const response = await fetch(reportTemplateSvg);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (!svgElement) throw new Error('Could not parse SVG template');
        const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

        const addTextElement = (x: number, y: number, text: string, className: string = 'st5') => {
          const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
          textElement.setAttribute('class', className);
          textElement.setAttribute('transform', `translate(${x} ${y})`);
          textElement.setAttribute('font-family', 'Arial, "Microsoft YaHei", "SimSun", sans-serif');
          textElement.textContent = text;
          return textElement;
        };

        const addWrappedTextElement = (x: number, y: number, text: string, className: string = 'st5', lineHeight: number = 20) => {
          const wrappedLines = wrapText(text, 50); // Reduced from 80 to prevent overflow
          const textElements: SVGTextElement[] = [];
          wrappedLines.forEach((line, index) => {
            const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('class', className);
            textElement.setAttribute('transform', `translate(${x} ${y + (index * lineHeight)})`);
            textElement.setAttribute('font-family', 'Arial, "Microsoft YaHei", "SimSun", sans-serif');
            textElement.setAttribute('font-size', '10px');
            textElement.textContent = line;
            textElements.push(textElement);
          });
          return textElements;
        };

        const textElements = [
          { x: 206.17, y: 222.41, text: studentName },
          { x: 206.17, y: 250.43, text: classLevel },
          { x: 206.44, y: 278.45, text: classLocation },
          { x: 327.71, y: 727.44, text: teacher },
          { x: 327.71, y: 745.52, text: date }
        ];

        // Remove all numerical markers (1-6) from both st1 and st2 classes
        svgClone.querySelectorAll('text.st1, text.st2').forEach(text => {
          if (text.textContent && /^[123456]$/.test(text.textContent.trim())) text.remove();
        });

        textElements.forEach(({ x, y, text }) => svgClone.appendChild(addTextElement(x, y, text, 'st5')));

        if (comments?.trim()) {
          addWrappedTextElement(179.27, 590.33, comments, 'st5', 20).forEach(element => svgClone.appendChild(element));
        }

        if (artwork) {
          try {
            const dataUrl = await convertUrlToDataUrl(artwork);
            const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
            imageElement.setAttribute('href', dataUrl);
            imageElement.setAttribute('x', '97.64'); // Centered: (595.28 - 400) / 2
            imageElement.setAttribute('y', '308.45'); // Below class location
            imageElement.setAttribute('width', '400');
            imageElement.setAttribute('height', '250');
            imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svgClone.appendChild(imageElement);
          } catch (error) { console.error('Failed to load artwork image:', error); }
        }

        const logoElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
        logoElement.setAttribute('href', nsalogoPng);
        logoElement.setAttribute('x', '460');
        logoElement.setAttribute('y', '680');
        logoElement.setAttribute('width', '80');
        logoElement.setAttribute('height', '80');
        logoElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgClone.appendChild(logoElement);

        svgClone.setAttribute('width', '595.28');
        svgClone.setAttribute('height', '841.89');
        svgClone.setAttribute('viewBox', '0 0 595.28 841.89');

        const styleElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleElement.textContent = `
          text { 
            fill: black !important; 
            fill-opacity: 1 !important; 
            opacity: 1 !important; 
            color: black !important;
            font-family: Arial, "Microsoft YaHei", "SimSun", "Noto Sans CJK SC", sans-serif !important;
            font-weight: normal !important;
          } 
          .st1, .st2 { 
            fill: transparent !important; 
            fill-opacity: 0 !important; 
            opacity: 0 !important; 
          }
          .st5 { 
            fill: black !important; 
            fill-opacity: 1 !important; 
            opacity: 1 !important; 
          }
          @media (max-width: 768px) {
            svg { max-width: 100%; height: auto; }
          }
        `;
        svgClone.appendChild(styleElement);

        setState(prev => ({ ...prev, processedSvg: new XMLSerializer().serializeToString(svgClone) }));
      } catch (error) {
        console.error('Error processing SVG template:', error);
        const response = await fetch(reportTemplateSvg);
        const svgText = await response.text();
        setState(prev => ({ ...prev, processedSvg: svgText }));
      } finally {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    processSvgTemplate();
  }, [studentName, classLevel, classLocation, comments, teacher, date, artwork]);


  return state.isLoading ? (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-2">Loading report template...</span>
    </div>
  ) : (
    <div className="w-full bg-white p-4">
      <div className="border rounded-lg overflow-hidden shadow-lg">
        <div 
          ref={svgRef} 
          className="w-full overflow-auto"
          style={{ 
            maxHeight: 'calc(95vh - 120px)',
            display: 'flex',
            justifyContent: 'center',
            padding: '20px'
          }}
          dangerouslySetInnerHTML={{ __html: state.processedSvg }} 
        />
      </div>
    </div>
  );
};

export default ReportTemplate;
