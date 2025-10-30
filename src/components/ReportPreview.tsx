import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import reportTemplateSvg from '@/assets/report-template.svg?url';
import nsalogoPng from '@/assets/NSALogo.png?url';
// WebP version available at: @/assets/NSALogo.webp (27KB vs 108KB PNG)
import { getTeacherByEmail } from '@/services/firebaseService-ultra-final';
import { refreshDownloadURL } from '@/services/storageService';
import { isReportReadyForPDF } from '@/services/pdfGenerationService';
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
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [generatingPng, setGeneratingPng] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  const studentName = `${student.firstName} ${student.lastName}`;
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Loading...';
  
  // Download is always enabled
  const canDownload = true;

  // Convert URL to data URL for images (currently only used for logo)
  const convertUrlToDataUrl = async (url: string): Promise<string> => {
    // For Firebase Storage URLs, try to refresh the URL if it might be expired
    const isFirebaseStorage = url.includes('firebasestorage.googleapis.com');
    
    if (isFirebaseStorage) {
      try {
        // Try to get a fresh download URL in case the current one has expired
        url = await refreshDownloadURL(url);
      } catch (error) {
        console.warn('Could not refresh download URL, trying original URL:', error);
      }
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      if (isFirebaseStorage) {
        // Try without crossOrigin first for Firebase Storage URLs
        img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) { 
            reject(new Error('Could not get canvas context'));
            return; 
          }
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
          
          // Try to export canvas - may fail due to CORS/tainting
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            resolve(dataUrl);
          } catch (error) {
            // If canvas is tainted due to CORS, reject the promise so report can't generate
            console.error('Canvas tainted (CORS issue), artwork is required for report generation');
            reject(new Error('Failed to process artwork image due to security restrictions. Please re-upload the image.'));
          }
        } catch (error) { 
          console.error('Canvas conversion failed:', error);
          reject(error);
        }
      };
      
      img.onerror = () => {
        console.warn('Firebase Storage image failed without crossOrigin, trying with crossOrigin:', url);
        // Retry with crossOrigin
        const retryImg = new Image();
        retryImg.crossOrigin = 'anonymous';
        retryImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { 
              reject(new Error('Could not get canvas context'));
              return; 
            }
            canvas.width = retryImg.naturalWidth;
            canvas.height = retryImg.naturalHeight;
            ctx.drawImage(retryImg, 0, 0);
            
            // Try to export canvas - may fail due to CORS/tainting
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              resolve(dataUrl);
            } catch (error) {
              // If canvas is tainted due to CORS, reject the promise so report can't generate
              console.error('Canvas tainted on retry (CORS issue), artwork is required for report generation');
              reject(new Error('Failed to process artwork image due to security restrictions. Please re-upload the image.'));
            }
          } catch (error) { 
            console.error('Canvas conversion failed on retry:', error);
            reject(error);
          }
        };
        retryImg.onerror = () => {
          console.error('Image load failed even with crossOrigin (likely expired token):', url);
          // Reject so report generation fails - artwork is required
          reject(new Error('Artwork image could not be loaded. Please re-upload the image.'));
        };
        retryImg.src = url;
      };
      
      img.src = url;
    } else {
      // For non-Firebase URLs, use crossOrigin
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) { 
            reject(new Error('Could not get canvas context'));
            return; 
          }
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
      }
    });
  };

  // Generate PNG from SVG for preview
  const generatePngPreview = async () => {
    if (!teacher) return;
    
    setGeneratingPng(true);
    setPreviewError(null); // Clear any previous errors
    toast.info('Generating report preview...', { duration: 2000 });
    try {
      // Create a temporary ReportTemplate component to get the SVG
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '595px';
      tempDiv.style.height = '600px';
      document.body.appendChild(tempDiv);

      // Create SVG element
      const response = await fetch(reportTemplateSvg);
      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      if (!svgElement) throw new Error('Could not parse SVG template');
      
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Process SVG (same logic as ReportTemplate)
      const textElements = [
        { x: 206.17, y: 222.41, text: studentName },
        { x: 206.17, y: 250.43, text: classData.classLevel },
        { x: 206.44, y: 278.45, text: classData.classLocation },
        { x: 327.71, y: 727.44, text: teacherName },
        { x: 327.71, y: 745.52, text: date }
      ];

      // Add text elements
      textElements.forEach(({ x, y, text }) => {
        const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x.toString());
        textElement.setAttribute('y', y.toString());
        textElement.setAttribute('class', 'st5');
        textElement.setAttribute('fill', 'black');
        textElement.setAttribute('font-family', 'Noto Sans SC, Arial, sans-serif');
        textElement.setAttribute('font-size', '11');
        textElement.textContent = text;
        svgClone.appendChild(textElement);
      });

      // Add comments if present with proper text wrapping for Chinese characters
      if (reportText?.trim()) {
        const wrapText = (text: string, maxWidth: number): string[] => {
          const lines: string[] = [];
          let currentLine = '';
          
          // Split by characters (not words) for Chinese text
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const testLine = currentLine + char;
            
            // Estimate width: Chinese chars ~11px, English chars ~6.5px
            let estimatedWidth = 0;
            for (let j = 0; j < testLine.length; j++) {
              const c = testLine[j];
              // Check if character is Chinese (CJK)
              if (/[\u4e00-\u9fff]/.test(c)) {
                estimatedWidth += 11; // Chinese character width
              } else {
                estimatedWidth += 6.5; // English character width
              }
            }
            
            if (estimatedWidth > maxWidth && currentLine) {
              lines.push(currentLine);
              currentLine = char;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
          return lines;
        };
        
        const wrappedLines = wrapText(reportText, 350); // Max width for comments area
        wrappedLines.forEach((line, index) => {
          const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
          textElement.setAttribute('x', '179.27');
          textElement.setAttribute('y', (590.33 + index * 15).toString());
          textElement.setAttribute('class', 'st5');
          textElement.setAttribute('fill', 'black');
          textElement.setAttribute('font-family', 'Noto Sans SC, Arial, sans-serif');
          textElement.setAttribute('font-size', '11');
          textElement.textContent = line;
          svgClone.appendChild(textElement);
        });
      }

      // Add artwork if present - REQUIRED when provided
      if (artworkUrl) {
        // Always refresh the URL to ensure it's valid and not expired
        const freshUrl = await refreshDownloadURL(artworkUrl);
        
        // Load image and convert to data URL to embed in SVG
        // Always use crossOrigin='anonymous' to avoid CORS tainting
        const artworkDataUrl = await new Promise<string>((resolve, reject) => {
          // Always use crossOrigin='anonymous' to avoid tainted canvas
          // Set it BEFORE setting src, otherwise it's ignored
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
              
              // Try to export canvas - should work if crossOrigin was set correctly
              try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
              } catch (error) {
                // If canvas is tainted, we can't convert to data URL
                // Fallback: use the Firebase URL directly in SVG (same as PDF generation)
                // The browser should be able to load it when converting SVG to PNG
                console.warn('Canvas tainted despite crossOrigin, will use Firebase URL directly in SVG:', error);
                resolve(freshUrl); // Return URL instead of data URL
              }
            } catch (error) { 
              console.error('Canvas conversion failed:', error);
              reject(error);
            }
          };
          
          artworkImg.onerror = (error) => {
            console.error('Image failed to load with crossOrigin:', freshUrl, error);
            reject(new Error(`Artwork image could not be loaded. Please check CORS configuration or re-upload the image. URL: ${freshUrl.substring(0, 100)}...`));
          };
          
          // Set src AFTER crossOrigin to ensure it takes effect
          artworkImg.src = freshUrl;
        });
        
        // Add to SVG
        const artworkElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
        artworkElement.setAttribute('href', artworkDataUrl);
        artworkElement.setAttribute('x', '97.64');
        artworkElement.setAttribute('y', '308.45');
        artworkElement.setAttribute('width', '400');
        artworkElement.setAttribute('height', '250');
        artworkElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgClone.appendChild(artworkElement);
        
        // Verify the data URL or URL is valid
        if (!artworkDataUrl) {
          console.error('Invalid artwork URL/data URL');
          throw new Error('Failed to create valid URL for artwork');
        }
        // Log whether we're using data URL or direct URL
        if (artworkDataUrl.startsWith('data:image')) {
          console.log('Artwork data URL created successfully, length:', artworkDataUrl.length);
        } else {
          console.log('Using Firebase URL directly in SVG (fallback due to CORS):', artworkDataUrl.substring(0, 100));
        }
      }

      // Add school logo
      try {
        const logoDataUrl = await convertUrlToDataUrl(nsalogoPng);
        const logoElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
        logoElement.setAttribute('href', logoDataUrl);
        logoElement.setAttribute('x', '55');
        logoElement.setAttribute('y', '680');
        logoElement.setAttribute('width', '80');
        logoElement.setAttribute('height', '80');
        logoElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgClone.appendChild(logoElement);
      } catch (error) {
        console.error('Failed to load logo:', error);
      }

      // Set SVG attributes for 300 DPI
      const scale = 300 / 72;
      svgClone.setAttribute('width', (595 * scale).toString());
      svgClone.setAttribute('height', (842 * scale).toString());
      svgClone.setAttribute('viewBox', '0 0 595.28 841.89');

      tempDiv.appendChild(svgClone);

      // Convert to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      // Use same scale for canvas
      canvas.width = 595 * scale; // 2481px
      canvas.height = 842 * scale; // 3511px
      
      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svgClone);
      
      // Verify artwork is in SVG if it should be
      const artworkElements = svgClone.querySelectorAll('image');
      if (artworkUrl) {
        console.log('Number of image elements in SVG:', artworkElements.length);
        if (artworkElements.length === 0) {
          console.error('No image elements found in SVG despite artworkUrl being provided');
          throw new Error('Failed to add artwork to SVG');
        }
        // Check if artwork (data URL or URL) is in the serialized SVG
        const hasArtwork = svgData.includes('data:image') || svgData.includes('firebasestorage');
        if (!hasArtwork) {
          console.error('SVG does not contain artwork after serialization');
          const imageIdx = svgData.indexOf('<image');
          if (imageIdx >= 0) {
            console.error('SVG snippet:', svgData.substring(imageIdx, imageIdx + 200));
          }
          throw new Error('Artwork not found in serialized SVG');
        }
        console.log('SVG contains artwork, length:', svgData.length);
      }
      
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      // Wait a bit to ensure all embedded images in SVG are loaded
      img.onload = () => {
        // Give a small delay to ensure embedded images (data URLs) are fully decoded
        setTimeout(() => {
          try {
            // Verify the image has loaded properly by checking dimensions
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
              console.error('SVG image loaded but has zero dimensions');
              setPreviewError('SVG failed to render properly. The embedded images may not have loaded.');
              URL.revokeObjectURL(svgUrl);
              const tempDiv = document.querySelector('div[style*="-9999px"]');
              if (tempDiv) document.body.removeChild(tempDiv);
              setGeneratingPng(false);
              return;
            }
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const pngDataUrl = canvas.toDataURL('image/png');
            setPngDataUrl(pngDataUrl);
            setPreviewError(null); // Clear any errors on success
            URL.revokeObjectURL(svgUrl);
            document.body.removeChild(tempDiv);
            setGeneratingPng(false);
            toast.success('Preview ready', { duration: 2000 });
          } catch (error) {
            console.error('Error drawing SVG to canvas:', error);
            setPreviewError(`Failed to convert SVG to PNG: ${error instanceof Error ? error.message : String(error)}`);
            URL.revokeObjectURL(svgUrl);
            document.body.removeChild(tempDiv);
            setGeneratingPng(false);
          }
        }, 100); // Small delay to ensure data URLs are decoded
      };
      
      img.onerror = (error) => {
        console.error('Failed to load SVG as image:', error);
        console.error('SVG URL:', svgUrl);
        console.error('SVG data length:', svgData.length);
        // Log a snippet of SVG to debug
        console.error('SVG snippet (first 500 chars):', svgData.substring(0, 500));
        if (artworkUrl) {
          console.error('Artwork URL that should be in SVG:', artworkUrl);
        }
        const errorMsg = 'Failed to load SVG for preview. The SVG may contain invalid image references.';
        setPreviewError(errorMsg);
        toast.error('Failed to generate preview', {
          description: errorMsg,
          duration: 4000
        });
        URL.revokeObjectURL(svgUrl);
        const tempDiv = document.querySelector('div[style*="-9999px"]');
        if (tempDiv) document.body.removeChild(tempDiv);
        setGeneratingPng(false);
      };
      
      img.src = svgUrl;
      
    } catch (error) {
      console.error('Error generating PNG preview:', error);
      setGeneratingPng(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate preview';
      setPreviewError(errorMessage);
      toast.error('Failed to generate preview', {
        description: errorMessage,
        duration: 4000
      });
      const tempDiv = document.querySelector('div[style*="-9999px"]');
      if (tempDiv) document.body.removeChild(tempDiv);
    }
  };
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

  // Generate PNG preview when teacher data is available
  useEffect(() => {
    if (teacher && !pngDataUrl && !previewError) {
      generatePngPreview();
    }
  }, [teacher]); // Only regenerate when teacher changes

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
            <DialogContent className="max-w-4xl p-2">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Report Preview - {studentName}</DialogTitle>
                <DialogDescription>
                  Preview of the student report for {studentName} in {classData.classLevel}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-auto max-h-[85vh] flex justify-center">
                {loading || generatingPng ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>{loading ? 'Loading teacher information...' : 'Generating preview...'}</span>
                  </div>
                ) : pngDataUrl ? (
                  <img 
                    src={pngDataUrl} 
                    alt={`Report preview for ${studentName}`}
                    className="w-full h-auto"
                    style={{ maxHeight: 'none', objectFit: 'contain' }}
                  />
                ) : previewError ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <span className="text-red-600 font-semibold mb-2">Preview Error</span>
                    <span className="text-sm text-center">{previewError}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <span>Preview not available</span>
                  </div>
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
          // Validate report meets PDF generation criteria
          const reportForValidation: ReportData = {
            id: reportData?.id || '',
            studentId: student.id,
            classId: classData.id,
            teacherEmail: classData.teacherEmail,
            reportText: reportText?.trim() || '',
            artworkUrl: artworkUrl || undefined,
            createdAt: reportData?.createdAt || new Date(),
            updatedAt: reportData?.updatedAt || new Date()
          };
          
          if (!isReportReadyForPDF(reportForValidation)) {
            toast.error('PDF generation requires both an image and written feedback', {
              description: 'Please add both an image and written feedback to generate a PDF report'
            });
            return;
          }
          
          const toastId = toast.loading('Generating PDF report...', {
            description: 'This may take a few seconds'
          });
          
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

            const addWrappedTextElement = (x: number, y: number, text: string, lineHeight: number = 16) => {
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
            
            // Add artwork image if available - use data URL (same as preview) so server doesn't need to fetch
            if (artworkUrl) {
              try {
                // Refresh the URL to ensure it's valid
                const freshUrl = await refreshDownloadURL(artworkUrl);
                
                // Convert to data URL (same approach as preview)
                const artworkDataUrl = await new Promise<string>((resolve, reject) => {
                  const artworkImg = new Image();
                  artworkImg.crossOrigin = 'anonymous'; // Always use crossOrigin to avoid tainted canvas
                  
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
                        // If canvas is tainted, fallback to URL (server might be able to fetch it)
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
                throw new Error('Artwork image is required for PDF. Please re-upload the image.');
              }
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
              // Check if we're on localhost (local development)
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return 'http://localhost:8888/.netlify/functions/svg2pdf';
              }
              // Check if we're on development branch (development--nsastudentreports.netlify.app)
              if (window.location.hostname === 'development--nsastudentreports.netlify.app') {
                return `${window.location.origin}/.netlify/functions/svg2pdf`;
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
            
            // Update toast to success
            toast.success('PDF report downloaded!', {
              id: toastId,
              description: `${fileName}`
            });
            
          } catch (error) {
            console.error('Error generating PDF:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
            toast.error('Failed to generate PDF', {
              id: toastId,
              description: errorMessage
            });
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
