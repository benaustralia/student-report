import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Download } from 'lucide-react';
import reportTemplateSvg from '@/assets/report-template.svg?url';
import { ReportTemplate } from './ReportTemplate';
import { getTeacherByEmail } from '@/services/firebaseService';
import type { Student, Class, ReportData, Teacher } from '@/types';
// PDF generation is now handled server-side via Netlify function

interface ReportPreviewProps {
  student: Student;
  classData: Class;
  reportData?: ReportData;
  reportText: string;
  artworkUrl?: string | null;
  isImageUploading?: boolean;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  student,
  classData,
  reportData,
  reportText,
  artworkUrl,
  isImageUploading = false
}) => {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedTeacherEmail, setFetchedTeacherEmail] = useState<string | null>(null);
  
  const studentName = `${student.firstName} ${student.lastName}`;
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Loading...';
  
  // Download is always enabled
  const canDownload = true;
  // Handle both Firestore timestamp objects and JavaScript Date objects
  const getDateFromTimestamp = (timestamp: unknown): Date => {
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      // Firestore timestamp object
      return new Date((timestamp as { seconds: number }).seconds * 1000);
    } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      // Firestore Timestamp object with toDate method
      return (timestamp as { toDate: () => Date }).toDate();
    } else {
      // JavaScript Date object
      return new Date(timestamp as Date);
    }
  };
  
  const date = reportData?.updatedAt 
    ? getDateFromTimestamp(reportData.updatedAt).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');

  // Fetch teacher information
  useEffect(() => {
    const fetchTeacher = async () => {
      if (classData.teacherEmail && classData.teacherEmail !== fetchedTeacherEmail) {
        setLoading(true);
        try {
          const teacherData = await getTeacherByEmail(classData.teacherEmail);
          setTeacher(teacherData);
          setFetchedTeacherEmail(classData.teacherEmail);
        } catch (error) {
          console.error('Error fetching teacher:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchTeacher();
  }, [classData.teacherEmail, fetchedTeacherEmail]);

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={isImageUploading}
            className="w-full sm:w-auto"
          >
            {isImageUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading Image...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            )}
          </Button>
        </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-6xl h-[95vh] max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Report Preview - {studentName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading teacher information...</span>
            </div>
          ) : (
            <ReportTemplate
              studentName={studentName}
              classLevel={classData.classLevel}
              classLocation={classData.classLocation}
              comments={reportText}
              teacher={teacherName}
              date={date}
              artwork={artworkUrl || undefined}
            />
          )}
        </div>
      </DialogContent>
      </Dialog>
      <Button 
        variant="outline" 
        size="sm" 
        disabled={isImageUploading || !canDownload}
        className="w-full sm:w-auto"
        onClick={async () => {
          try {
            // Create SVG content
            const response = await fetch(reportTemplateSvg);
            const svgText = await response.text();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');
            if (!svgElement) throw new Error('Could not parse SVG template');
            
            const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
            
            // Remove all numerical markers (1-6) from both st1 and st2 classes
            svgClone.querySelectorAll('text.st1, text.st2').forEach(text => {
              if (text.textContent && /^[123456]$/.test(text.textContent.trim())) text.remove();
            });
            
            // Add text elements with Noto Sans SC font
            const addTextElement = (x: number, y: number, text: string) => {
              const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
              textElement.setAttribute('transform', `translate(${x} ${y})`);
              textElement.setAttribute('font-family', 'Noto Sans SC');
              textElement.setAttribute('fill', 'black');
              textElement.setAttribute('font-size', '13px');
              textElement.textContent = text;
              return textElement;
            };

            // Text wrapping function
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
                    // Check if current line ends with punctuation (English or Chinese)
                    const trimmedLine = currentLine.trim();
                    const punctuationMarks = ['.', '。', '!', '！', '?', '？', ',', '，', ';', '；', ':', '：'];
                    const endsWithPunctuation = punctuationMarks.some(mark => trimmedLine.endsWith(mark));
                    
                    if (endsWithPunctuation) {
                      // Keep punctuation with the last word - don't break the line here
                      // Instead, try to fit more text on this line or break earlier
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

            const addWrappedTextElement = (x: number, y: number, text: string, lineHeight: number = 20) => {
              const maxPixelWidth = 350; // Increased wrap width
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
            
            // Add student data
            svgClone.appendChild(addTextElement(206.17, 222.41, studentName));
            svgClone.appendChild(addTextElement(206.17, 250.43, classData.classLevel));
            svgClone.appendChild(addTextElement(206.44, 278.45, classData.classLocation));
            svgClone.appendChild(addTextElement(327.71, 727.44, teacherName));
            svgClone.appendChild(addTextElement(327.71, 745.52, date));
            
            if (reportText?.trim()) {
              const processedReportText = reportText.trim();
              const { textElements } = addWrappedTextElement(179.27, 590.33, processedReportText);
              textElements.forEach(element => svgClone.appendChild(element));
            }
            
            // Helper function to convert URL to data URL
  const convertUrlToDataUrl = async (url: string): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Now that CORS is configured, this should work
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (error) {
        console.error('Canvas conversion failed:', error);
        reject(error);
      }
    };
    img.onerror = () => {
      console.error('Image load failed:', url);
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });

            // Add artwork image if available
            if (artworkUrl) {
              console.log('🔍 DEBUG: Processing artwork image:', artworkUrl);
              try {
                const dataUrl = await convertUrlToDataUrl(artworkUrl);
                console.log('🔍 DEBUG: Image converted to data URL:', dataUrl.substring(0, 100) + '...');
                
                const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                imageElement.setAttribute('href', dataUrl);
                imageElement.setAttribute('x', '97.64');
                imageElement.setAttribute('y', '308.45');
                imageElement.setAttribute('width', '400');
                imageElement.setAttribute('height', '250');
                imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgClone.appendChild(imageElement);
                
                console.log('🔍 DEBUG: Image element added to SVG');
              } catch (error) { 
                console.error('❌ DEBUG: Failed to load artwork image:', error); 
              }
            } else {
              console.log('🔍 DEBUG: No artwork URL provided');
            }
            
            // Logo will be added in PDF generation from file system
            
            // Set SVG attributes
            svgClone.setAttribute('width', '595.28');
            svgClone.setAttribute('height', '841.89');
            svgClone.setAttribute('viewBox', '0 0 595.28 841.89');
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            
            // Add style element
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
            
            // Replace placeholder numbers with actual text
            const textElements = svgClone.querySelectorAll('text tspan');
            textElements.forEach((tspan) => {
              const textContent = tspan.textContent;
              if (textContent === '1') {
                tspan.textContent = studentName;
              } else if (textContent === '2') {
                tspan.textContent = classData.classLevel;
              } else if (textContent === '3') {
                tspan.textContent = classData.classLocation;
              } else if (textContent === '4') {
                // Handle text wrapping for report text
                const wrappedText = wrapTextWithNotoSans(reportText?.trim() || '', 350).join('\n');
                tspan.textContent = wrappedText;
              } else if (textContent === '5') {
                tspan.textContent = teacherName;
              } else if (textContent === '6') {
                tspan.textContent = date;
              }
            });
            
            // Convert SVG to string (with replaced text)
            const svgString = new XMLSerializer().serializeToString(svgClone);
            
            // Call Netlify function to generate PDF
            const getFunctionUrl = () => {
              if (import.meta.env.DEV) {
                // Check if we're on localhost (local development)
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  return 'http://localhost:8888/.netlify/functions/svg2pdf';
                }
                // Otherwise we're on Netlify dev server
                return 'https://devserver-development--nsastudentreports.netlify.app/.netlify/functions/svg2pdf';
              }
              // Production - use the correct production URL
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
                  studentName,
                  classLevel: classData.classLevel,
                  classLocation: classData.classLocation,
                  teacherName,
                  date,
                  reportText: reportText?.trim() || ''
                }
              }),
            });

            if (!functionResponse.ok) {
              throw new Error(`PDF generation failed: ${functionResponse.status}`);
            }

            const pdfBlob = await functionResponse.blob();
            
            // Generate and download PDF
            const fileName = `${studentName.replace(/\s+/g, '_')}_report.pdf`;
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
          } catch (error) {
            console.error('Error generating PDF:', error);
            alert(`Error generating PDF: ${error instanceof Error ? error.message : String(error)}`);
          }
        }}
      >
        <Download className="h-4 w-4 mr-2" />
        Download
      </Button>
    </div>
  );
};

export default ReportPreview;
