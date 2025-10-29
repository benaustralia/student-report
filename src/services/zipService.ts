import type { ReportData, Student, Teacher } from '@/types';
import { refreshDownloadURL } from './storageService';

// Dynamic import for JSZip to reduce initial bundle size
const getJSZip = async () => {
  const { default: JSZip } = await import('jszip');
  return JSZip;
};

// Helper function to safely convert Firestore timestamps to Date objects
const toDate = (dateValue: unknown): Date => {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Handle Firestore timestamp objects
  if (dateValue && typeof dateValue === 'object') {
    // Firestore timestamp with seconds property
    if ('seconds' in dateValue) {
      return new Date((dateValue as { seconds: number }).seconds * 1000);
    }
    // Firestore Timestamp object with toDate method
    if ('toDate' in dateValue && typeof (dateValue as { toDate: () => Date }).toDate === 'function') {
      return (dateValue as { toDate: () => Date }).toDate();
    }
  }
  
  // Handle null, undefined, or empty values
  if (!dateValue) {
    return new Date(); // Return current date as fallback
  }
  
  // Try to create a date from the value
  const date = new Date(dateValue as string | number | Date);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date value:', dateValue, 'using current date as fallback');
    return new Date(); // Return current date as fallback
  }
  
  return date;
};

// Legacy types for existing functionality
export interface ClassReport {
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date: string;
  artwork?: string;
}

export const downloadClassAsZIP = async (reports: ReportData[], className: string, students: Student[], teacher: Teacher): Promise<number> => {
  try {
    const JSZip = await getJSZip();
    const zip = new JSZip();
    const folder = zip.folder(className);

    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }

    // Process each report
    let successCount = 0;
    let errorCount = 0;
    for (const report of reports) {
      try {
        // Find student and teacher data
        const student = students.find(s => s.id === report.studentId);
        if (!student) {
          console.warn(`Student not found for report ${report.studentId}, skipping`);
          errorCount++;
          continue;
        }
        
        const studentName = `${student.firstName} ${student.lastName}`;
        const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher';
        
        // Validation: Skip reports with no text AND no image
        const hasText = report.reportText?.trim() || false;
        const hasImage = report.artworkUrl?.trim() || false;
        
        if (!hasText && !hasImage) {
          console.warn(`Skipping report for ${studentName} - no text and no image`);
          errorCount++;
          continue;
        }
        
        // Convert to legacy format for PDF generation
        const legacyReportData = {
          studentName,
          classLevel: className, // Use className as classLevel
          classLocation: 'Unknown Location', // This would need to be passed in
          comments: report.reportText || '',
          teacher: teacherName,
          date: toDate(report.createdAt).toLocaleDateString('en-GB'),
          artwork: report.artworkUrl || ''
        };

        // Generate PDF blob
        const pdfBlob = await generatePDFBlob(legacyReportData);
        
        if (!pdfBlob || pdfBlob.size === 0) {
          console.error(`Generated PDF blob is empty for ${studentName}`);
          errorCount++;
          continue;
        }
        
        // Add to ZIP
        const fileName = `${student.firstName}_${student.lastName}_${toDate(report.createdAt).toISOString().split('T')[0]}.pdf`;
        folder.file(fileName, pdfBlob);
        successCount++;
      } catch (error) {
        console.error(`Error processing report for student ${report.studentId}:`, error);
        errorCount++;
        // Continue with other reports even if one fails
      }
    }
    
    console.log(`ZIP generation: ${successCount} successful, ${errorCount} failed out of ${reports.length} reports`);

    if (successCount === 0) {
      throw new Error('No valid reports to download. Reports must have either text or an image.');
    }

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${className}_reports.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return successCount;
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    throw error;
  }
};

// Legacy function for existing ClassZIPButton
export const generateClassZIP = async (reports: ClassReport[], className: string, teacherName: string): Promise<number> => {
  try {
    const JSZip = await getJSZip();
    const zip = new JSZip();
    const folder = zip.folder(`${teacherName}_${className}`);

    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }

    // Process each report
    let successCount = 0;
    let errorCount = 0;
    for (const report of reports) {
      try {
        // Validation: Skip reports with no text AND no image
        const hasText = report.comments?.trim() || false;
        const hasImage = report.artwork?.trim() || false;
        
        if (!hasText && !hasImage) {
          console.warn(`Skipping report for ${report.studentName} - no text and no image`);
          errorCount++;
          continue;
        }
        
        // Generate PDF blob using the existing PDF service
        const pdfBlob = await generatePDFBlob(report);
        
        if (!pdfBlob || pdfBlob.size === 0) {
          console.error(`Generated PDF blob is empty for ${report.studentName}`);
          errorCount++;
          continue;
        }
        
        // Add to ZIP
        const fileName = `${report.studentName.replace(/\s+/g, '_')}_${report.date.replace(/\//g, '-')}.pdf`;
        folder.file(fileName, pdfBlob);
        successCount++;
      } catch (error) {
        console.error(`Error processing report for ${report.studentName}:`, error);
        errorCount++;
        // Continue with other reports even if one fails
      }
    }
    
    console.log(`ZIP generation: ${successCount} successful, ${errorCount} failed out of ${reports.length} reports`);
    
    if (successCount === 0) {
      throw new Error('No valid reports to download. Reports must have either text or an image.');
    }

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${teacherName}_${className}_reports.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return successCount;
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    throw error;
  }
};

// Helper function to generate PDF as blob using the same method as ReportPreview
// Note: This uses the Netlify function (same as individual downloads)
const generatePDFBlob = async (reportData: ClassReport): Promise<Blob> => {
  try {
    // Import SVG template - using dynamic import with ?url suffix for Vite
    // Use the same import pattern as ReportPreview
    const reportTemplateSvgUrl = (await import('@/assets/report-template.svg?url')).default;
    
    // Fetch SVG template
    const response = await fetch(reportTemplateSvgUrl);
    if (!response.ok) {
      throw new Error(`Could not load SVG template: ${response.status} ${response.statusText}`);
    }
    const svgText = await response.text();
    
    if (!svgText || svgText.length === 0) {
      throw new Error('SVG template is empty');
    }
    
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) throw new Error('Could not parse SVG template');
    
    const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Remove numerical markers
    svgClone.querySelectorAll('text.st1, text.st2').forEach(text => {
      if (text.textContent && /^[123456]$/.test(text.textContent.trim())) text.remove();
    });
    
    // Add text elements - simplified version matching ReportPreview logic
    const addTextElement = (x: number, y: number, text: string) => {
      const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
      textElement.setAttribute('transform', `translate(${x} ${y})`);
      textElement.setAttribute('font-family', 'Noto Sans SC');
      textElement.setAttribute('fill', 'black');
      textElement.setAttribute('font-size', '13px');
      textElement.textContent = text;
      return textElement;
    };
    
    // Add student data
    svgClone.appendChild(addTextElement(206.17, 222.41, reportData.studentName));
    svgClone.appendChild(addTextElement(206.17, 250.43, reportData.classLevel));
    svgClone.appendChild(addTextElement(206.44, 278.45, reportData.classLocation));
    svgClone.appendChild(addTextElement(327.71, 727.44, reportData.teacher));
    svgClone.appendChild(addTextElement(327.71, 745.52, reportData.date));
    
    // Text wrapping function (same as ReportPreview)
    const wrapTextWithNotoSans = (text: string, maxPixelWidth: number): string[] => {
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      if (!measureCtx) return [text];
      
      measureCtx.font = '11px "Noto Sans SC", Arial, sans-serif';
      
      if (measureCtx.measureText(text).width <= maxPixelWidth) {
        return [text];
      }
      
      return wrapTextByWidth(text, maxPixelWidth, measureCtx);
    };

    const wrapTextByWidth = (text: string, maxPixelWidth: number, measureCtx: CanvasRenderingContext2D): string[] => {
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
      
      if (currentLine.length > 0) {
        lines.push(currentLine.trim());
      }
      
      return lines;
    };

    const addWrappedTextElement = (x: number, y: number, text: string, lineHeight: number = 16) => {
      const maxPixelWidth = 350;
      const wrappedLines = wrapTextWithNotoSans(text, maxPixelWidth);
      const textElements: SVGTextElement[] = [];
      
      wrappedLines.forEach((line, index) => {
        const trimmedLine = line.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
        if (trimmedLine) {
          const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
          textElement.setAttribute('transform', `translate(${x} ${y + (index * lineHeight)})`);
          textElement.setAttribute('font-family', 'Noto Sans SC');
          textElement.setAttribute('font-size', '11px');
          textElement.setAttribute('fill', 'black');
          textElement.textContent = trimmedLine;
          textElements.push(textElement);
        }
      });
      
      return { textElements };
    };
    
    // Add comments with proper text wrapping
    if (reportData.comments?.trim()) {
      const processedReportText = reportData.comments.trim();
      const { textElements } = addWrappedTextElement(179.27, 590.33, processedReportText);
      textElements.forEach(element => svgClone.appendChild(element));
    }
    
    // Add artwork if present - convert to data URL (same as ReportPreview)
    if (reportData.artwork) {
      try {
        const freshUrl = await refreshDownloadURL(reportData.artwork);
        
        // Convert to data URL
        const artworkDataUrl = await new Promise<string>((resolve, reject) => {
          const artworkImg = new Image();
          artworkImg.crossOrigin = 'anonymous';
          
          artworkImg.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) { 
                reject(new Error('Could not get canvas context'));
                return; 
              }
              canvas.width = artworkImg.naturalWidth;
              canvas.height = artworkImg.naturalHeight;
              ctx.drawImage(artworkImg, 0, 0);
              
              try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
              } catch (error) {
                console.warn('Canvas tainted, using Firebase URL directly:', error);
                resolve(freshUrl);
              }
            } catch (error) { 
              console.error('Canvas conversion failed:', error);
              reject(error);
            }
          };
          
          artworkImg.onerror = (error) => {
            console.error('Image failed to load with crossOrigin:', freshUrl, error);
            reject(new Error(`Artwork image could not be loaded: ${freshUrl.substring(0, 100)}...`));
          };
          
          artworkImg.src = freshUrl;
        });
        
        const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
        imageElement.setAttribute('href', artworkDataUrl);
        imageElement.setAttribute('x', '97.64');
        imageElement.setAttribute('y', '308.45');
        imageElement.setAttribute('width', '400');
        imageElement.setAttribute('height', '250');
        imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgClone.appendChild(imageElement);
      } catch (error) { 
        console.error('Failed to load artwork image for PDF:', error); 
        // Continue without artwork - don't fail entire ZIP
      }
    }
    
    // Set SVG attributes
    svgClone.setAttribute('width', '595.28');
    svgClone.setAttribute('height', '841.89');
    svgClone.setAttribute('viewBox', '0 0 595.28 841.89');
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    
    // Add style element (same as ReportPreview)
    const styleElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = `
      text { 
        fill: black !important; 
        fill-opacity: 1 !important; 
        opacity: 1 !important; 
        color: black !important;
        font-family: 'Noto Sans SC', Arial, sans-serif !important;
        font-weight: normal !important;
        font-size: 11px !important;
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
    `;
    svgClone.appendChild(styleElement);
    
    // Replace placeholder numbers with actual text (same as ReportPreview)
    const textElements = svgClone.querySelectorAll('text tspan');
    textElements.forEach((tspan) => {
      const textContent = tspan.textContent;
      if (textContent === '1') {
        tspan.textContent = reportData.studentName;
      } else if (textContent === '2') {
        tspan.textContent = reportData.classLevel;
      } else if (textContent === '3') {
        tspan.textContent = reportData.classLocation;
      } else if (textContent === '4') {
        const wrappedText = wrapTextWithNotoSans(reportData.comments?.trim() || '', 350).join('\n');
        tspan.textContent = wrappedText;
      } else if (textContent === '5') {
        tspan.textContent = reportData.teacher;
      } else if (textContent === '6') {
        tspan.textContent = reportData.date;
      }
    });
    
    // Serialize SVG
    const svgString = new XMLSerializer().serializeToString(svgClone);
    
    // Call Netlify function to generate PDF
    const getFunctionUrl = () => {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8888/.netlify/functions/svg2pdf';
      }
      if (window.location.hostname === 'development--nsastudentreports.netlify.app') {
        return `${window.location.origin}/.netlify/functions/svg2pdf`;
      }
      return 'https://nsastudentreports.netlify.app/.netlify/functions/svg2pdf';
    };
    
    const functionUrl = getFunctionUrl();
    const functionResponse = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        svg: svgString,
        textData: {
          studentName: reportData.studentName,
          classLevel: reportData.classLevel,
          classLocation: reportData.classLocation,
          teacherName: reportData.teacher,
          date: reportData.date,
          reportText: reportData.comments?.trim() || ''
        }
      }),
    });

    if (!functionResponse.ok) {
      const errorText = await functionResponse.text();
      console.error('PDF generation failed:', functionResponse.status, errorText);
      throw new Error(`PDF generation failed: ${functionResponse.status} - ${errorText.substring(0, 200)}`);
    }

    const pdfBlob = await functionResponse.blob();
    
    // Verify it's actually a PDF (not an error response)
    if (pdfBlob.type !== 'application/pdf') {
      // Might be a JSON error response
      const text = await pdfBlob.text();
      console.error('Received non-PDF response:', text.substring(0, 500));
      throw new Error(`Server returned non-PDF content: ${pdfBlob.type}. This might be an error response.`);
    }
    
    if (pdfBlob.size === 0) {
      throw new Error('Generated PDF blob is empty');
    }
    
    return pdfBlob;
  } catch (error) {
    console.error('Error generating PDF blob:', error);
    throw error;
  }
};