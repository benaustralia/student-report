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
import nsalogoPng from '@/assets/NSALogo.png?url';
import { ReportTemplate } from './ReportTemplate';
import { getTeacherByEmail } from '@/services/firebaseService';
import type { Student, Class, ReportData, Teacher } from '@/types';

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
    <div className="flex gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={isImageUploading}
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
        disabled={isImageUploading}
        onClick={async () => {
          try {
            const { jsPDF } = await import('jspdf');
            const { svg2pdf } = await import('svg2pdf.js');
            
            // Load Chinese fonts and wait for them to be ready
            const fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
            
            // Wait for fonts to load properly with more robust checking
            await document.fonts.ready;
            
            // Additional wait to ensure Chinese fonts are fully loaded
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify that Chinese characters can be rendered properly
            const testCanvas = document.createElement('canvas');
            const testCtx = testCanvas.getContext('2d');
            if (testCtx) {
              testCtx.font = '10px "Noto Sans SC", "Microsoft YaHei", "SimSun", sans-serif';
              const testMetrics = testCtx.measureText('。');
              // If the full stop is rendering as a very narrow character, the font might not be loaded
              if (testMetrics.width < 5) {
                console.warn('Chinese fonts may not be fully loaded, using fallback fonts');
                // Wait a bit more for fonts to load
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
            
            // Create a temporary ReportTemplate to generate the SVG
            const tempDiv = document.createElement('div');
            document.body.appendChild(tempDiv);
            
            // We'll create the SVG content directly here
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
            
            // Add text elements with proper Chinese font support
            const addTextElement = (x: number, y: number, text: string) => {
              const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
              textElement.setAttribute('transform', `translate(${x} ${y})`);
              textElement.setAttribute('font-family', 'Arial, "Microsoft YaHei", "SimSun", "Noto Sans CJK SC", sans-serif');
              textElement.setAttribute('fill', 'black');
              textElement.setAttribute('font-size', '12px');
              textElement.textContent = text;
              return textElement;
            };


            // Wrapping function for Chinese text (rendered as images) - respects word boundaries
            const wrapChineseText = (text: string, maxPixelWidth: number): string[] => {
              const measureCanvas = document.createElement('canvas');
              const measureCtx = measureCanvas.getContext('2d');
              if (!measureCtx) return [text];
              
              // Use enhanced Chinese font stack for measurement (matches renderTextAsImage)
              const fontStack = '"Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "Microsoft JhengHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "WenQuanYi Micro Hei", "SimSun", "SimHei", "Arial Unicode MS", Arial, sans-serif';
              measureCtx.font = `10px ${fontStack}`;
              
              if (measureCtx.measureText(text).width <= maxPixelWidth) {
                return [text];
              }
              
              return wrapChineseTextByWidth(text, maxPixelWidth, measureCtx);
            };

            // Specialized Chinese text wrapping that respects word boundaries
            const wrapChineseTextByWidth = (text: string, maxPixelWidth: number, measureCtx: CanvasRenderingContext2D): string[] => {
              const lines: string[] = [];
              let currentLine = '';
              
              // Split by punctuation marks and spaces, but preserve the separators
              // Chinese punctuation marks: 。！？，、；：
              const tokens = text.split(/(\s+|[。！？，、；：])/);
              
              for (const token of tokens) {
                if (!token) continue;
                
                // Test if adding this token would exceed the pixel width limit
                const testLine = currentLine + token;
                const testWidth = measureCtx.measureText(testLine).width;
                
                if (testWidth > maxPixelWidth) {
                  if (currentLine.length > 0) {
                    lines.push(currentLine.trim());
                    currentLine = token;
                  } else {
                    // For Chinese text, if a single token is too wide, we should still avoid breaking words
                    // Instead, try to break at more granular punctuation boundaries
                    if (measureCtx.measureText(token).width > maxPixelWidth) {
                      // Try breaking at more specific punctuation marks
                      const fineTokens = token.split(/([，。！？；：])/);
                      let fineCurrentLine = '';
                      
                      for (const fineToken of fineTokens) {
                        if (!fineToken) continue;
                        
                        const fineTestLine = fineCurrentLine + fineToken;
                        const fineTestWidth = measureCtx.measureText(fineTestLine).width;
                        
                        if (fineTestWidth > maxPixelWidth && fineCurrentLine.length > 0) {
                          lines.push(fineCurrentLine.trim());
                          fineCurrentLine = fineToken;
                        } else {
                          fineCurrentLine += fineToken;
                        }
                      }
                      
                      if (fineCurrentLine.length > 0) {
                        currentLine = fineCurrentLine;
                      } else {
                        // If even the finest token is too wide, we have no choice but to break
                        // But we'll do it more gracefully by trying to keep meaningful chunks
                        const chars = Array.from(token);
                        let charLine = '';
                        
                        for (const char of chars) {
                          const charTestLine = charLine + char;
                          const charTestWidth = measureCtx.measureText(charTestLine).width;
                          
                          if (charTestWidth > maxPixelWidth && charLine.length > 0) {
                            lines.push(charLine);
                            charLine = char;
                          } else {
                            charLine += char;
                          }
                        }
                        currentLine = charLine;
                      }
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

            // Wrapping function for English text (rendered as SVG text)
            const wrapEnglishText = (text: string, maxPixelWidth: number): string[] => {
              const measureCanvas = document.createElement('canvas');
              const measureCtx = measureCanvas.getContext('2d');
              if (!measureCtx) return [text];
              
              // Use Arial font for measurement (matches SVG text rendering)
              measureCtx.font = '10px Arial, sans-serif';
              
              if (measureCtx.measureText(text).width <= maxPixelWidth) {
                return [text];
              }
              
              return wrapTextByWidth(text, maxPixelWidth, measureCtx);
            };

            // Common wrapping logic that works with any font context
            const wrapTextByWidth = (text: string, maxPixelWidth: number, measureCtx: CanvasRenderingContext2D): string[] => {
              const lines: string[] = [];
              let currentLine = '';
              
              // Split by words and punctuation, but preserve the separators
              const tokens = text.split(/(\s+|[。！？，、；：])/);
              
              for (const token of tokens) {
                if (!token) continue;
                
                // Test if adding this token would exceed the pixel width limit
                const testLine = currentLine + token;
                const testWidth = measureCtx.measureText(testLine).width;
                
                if (testWidth > maxPixelWidth) {
                  if (currentLine.length > 0) {
                    lines.push(currentLine.trim());
                    currentLine = token;
                  } else {
                    // If even a single token is too wide, break it character by character
                    if (measureCtx.measureText(token).width > maxPixelWidth) {
                      let tempLine = '';
                      for (const char of token) {
                        const testCharLine = tempLine + char;
                        if (measureCtx.measureText(testCharLine).width > maxPixelWidth) {
                          if (tempLine.length > 0) {
                            lines.push(tempLine);
                            tempLine = char;
                          } else {
                            // Even single character is too wide, force add it
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

            // Function to fix corrupted Chinese punctuation characters
            const fixChinesePunctuation = (text: string): string => {
              if (!text || !/[\u4e00-\u9fff]/.test(text)) {
                return text; // No Chinese characters, return as is
              }
              
              let fixedText = text;
              
              // Common Chinese punctuation corruption patterns
              const punctuationMappings: { [key: string]: string } = {
                '0': '。', // Full stop corruption
                'O': '。', // Alternative full stop corruption
                'o': '。', // Lowercase full stop corruption
                '1': '！', // Exclamation mark corruption
                '?': '？', // Question mark corruption (Western to Chinese)
                ',': '，', // Comma corruption (Western to Chinese)
                ';': '；', // Semicolon corruption (Western to Chinese)
                ':': '：', // Colon corruption (Western to Chinese)
                ' ': '、', // Space to Chinese enumeration mark (less common)
              };
              
              // Check if the last character is a corrupted punctuation mark
              if (text.length > 0) {
                const lastChar = text[text.length - 1];
                if (punctuationMappings[lastChar]) {
                  console.log(`Detected corrupted Chinese punctuation: '${lastChar}' -> '${punctuationMappings[lastChar]}'`);
                  fixedText = text.slice(0, -1) + punctuationMappings[lastChar];
                }
              }
              
              // Also check for other common corruption patterns within the text
              for (const [corrupted, correct] of Object.entries(punctuationMappings)) {
                // Only replace if it's likely to be a Chinese punctuation mark in Chinese context
                if (corrupted !== '0' && corrupted !== 'O' && corrupted !== 'o') {
                  // Replace standalone punctuation marks that are likely Chinese
                  const regex = new RegExp(`([\\u4e00-\\u9fff])${corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\u4e00-\\u9fff\\s]|$)`, 'g');
                  fixedText = fixedText.replace(regex, `$1${correct}$2`);
                }
              }
              
              // Special handling for Chinese full stop preservation
              // If the text ends with a Chinese character but no punctuation, add a full stop
              if (fixedText.length > 0) {
                const lastChar = fixedText[fixedText.length - 1];
                const isChineseChar = /[\u4e00-\u9fff]/.test(lastChar);
                const isChinesePunctuation = /[。！？，、；：]/.test(lastChar);
                
                if (isChineseChar && !isChinesePunctuation) {
                  // Check if this looks like the end of a sentence by looking for previous punctuation
                  const hasPreviousPunctuation = /[。！？]/.test(fixedText.slice(0, -1));
                  if (hasPreviousPunctuation) {
                    console.log('Adding Chinese full stop to sentence ending with:', lastChar);
                    fixedText += '。';
                  }
                }
              }
              
              // Remove any trailing "0" characters that might have been added after Chinese punctuation
              while (fixedText.length > 1 && fixedText.endsWith('0') && /[。！？，、；：]/.test(fixedText[fixedText.length - 2])) {
                console.log('Removing trailing 0 after Chinese punctuation');
                fixedText = fixedText.slice(0, -1);
              }
              
              return fixedText;
            };

            // Create a canvas to render Chinese text as images at 300 DPI
            const renderTextAsImage = (text: string, fontSize: number = 10): string => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) return '';
              
              // Clean the text to ensure Chinese punctuation is preserved
              // Remove only standard whitespace, not Chinese punctuation
              let cleanText = text.replace(/^[\s\u00A0\u2000-\u200F\u2028-\u202F]+|[\s\u00A0\u2000-\u200F\u2028-\u202F]+$/g, '');
              
              // Fix any corrupted Chinese punctuation characters
              cleanText = fixChinesePunctuation(cleanText);
              
              
              if (cleanText.length > 1) {
                const lastChar = cleanText[cleanText.length - 1];
                const secondLastChar = cleanText[cleanText.length - 2];
                if (lastChar === '0' && /[。！？，、；：]/.test(secondLastChar)) {
                  cleanText = cleanText.slice(0, -1);
                }
              }
              
              // Set DPI scaling factor (300 DPI / 72 DPI = 4.17)
              const dpiScale = 300 / 72;
              const scaledFontSize = fontSize * dpiScale;
              
              // Enhanced font stack with better Chinese punctuation support
              // Prioritize system fonts that are more likely to have Chinese punctuation
              const fontStack = [
                '"Noto Sans SC"',
                '"Noto Sans CJK SC"',
                '"Microsoft YaHei"',
                '"Microsoft JhengHei"',
                '"PingFang SC"',
                '"Hiragino Sans GB"',
                '"Source Han Sans SC"',
                '"WenQuanYi Micro Hei"',
                '"SimSun"',
                '"SimHei"',
                'Arial Unicode MS',
                'Arial',
                'sans-serif'
              ].join(', ');
              
              ctx.font = `${scaledFontSize}px ${fontStack}`;
              
              // Measure text width more accurately using cleaned text
              const textMetrics = ctx.measureText(cleanText);
              const textWidth = textMetrics.width;
              const textHeight = scaledFontSize * 1.4;
              
              // Set canvas size at high resolution with minimum dimensions
              canvas.width = Math.max(textWidth + 8, 50); // Add padding, minimum 50px width
              canvas.height = Math.max(textHeight, 20); // Minimum 20px height
              
              // Set font again after canvas resize with enhanced fallback
              ctx.font = `${scaledFontSize}px ${fontStack}`;
              ctx.fillStyle = 'black';
              ctx.textBaseline = 'top';
              
              // Try to ensure font is loaded by checking if the character renders correctly
              const testChar = '。';
              const testMetrics = ctx.measureText(testChar);
              
              // If the full stop character has unusual width, it might not be rendering correctly
              if (testMetrics.width < scaledFontSize * 0.3) {
                ctx.font = `${scaledFontSize}px "Microsoft YaHei", "SimSun", Arial Unicode MS, sans-serif`;
              }
              
              // Additional test: Check if the font is rendering Chinese characters correctly
              const testChineseChar = '德';
              const testChineseMetrics = ctx.measureText(testChineseChar);
              
              // If Chinese characters are rendering with unusual widths, force a different font
              if (testChineseMetrics.width < scaledFontSize * 0.5) {
                ctx.font = `${scaledFontSize}px "SimSun", "Microsoft YaHei", Arial Unicode MS, sans-serif`;
              }
              
              // Final cleanup: Remove any trailing "0" characters after Chinese punctuation
              let finalText = cleanText;
              while (finalText.length > 1 && finalText.endsWith('0') && /[。！？，、；：]/.test(finalText[finalText.length - 2])) {
                finalText = finalText.slice(0, -1);
              }
              
              // Render cleaned text
              ctx.fillText(finalText, 4, 4); // Add small padding
              
              return canvas.toDataURL('image/png');
            };

            const addWrappedTextElement = (x: number, y: number, text: string, lineHeight: number = 20) => {
              // Calculate max width based on available space in the report template
              // Comments section starts at x=179.27 and should fit within the template bounds
              // Reduced width to avoid overlapping with logo area on the right
              const maxPixelWidth = 280; // Narrower width to avoid logo overlap
              
              // Split text into sentences and group by language type
              const paragraphs: string[] = [];
              
              // Split on both English and Chinese sentence endings
              const sentences = text.split(/([.!?。！？][\s]*)/);
              let currentParagraph = '';
              let currentIsChineseBlock: boolean | null = null;
              
              for (let i = 0; i < sentences.length; i += 2) {
                const sentence = (sentences[i] || '') + (sentences[i + 1] || '');
                if (!sentence.trim()) continue;
                
                // Determine if this sentence is primarily Chinese
                const chineseChars = (sentence.match(/[\u4e00-\u9fff]/g) || []).length;
                const totalChars = sentence.replace(/\s/g, '').length;
                const sentenceIsChinese = chineseChars > totalChars * 0.3; // More than 30% Chinese chars
                
                // If this sentence type differs from current paragraph type, start new paragraph
                if (currentIsChineseBlock !== null && sentenceIsChinese !== currentIsChineseBlock) {
                  if (currentParagraph.trim()) {
                    paragraphs.push(currentParagraph.trim());
                  }
                  currentParagraph = '';
                }
                
                currentParagraph += (currentParagraph ? ' ' : '') + sentence.trim();
                currentIsChineseBlock = sentenceIsChinese;
              }
              
              // Add the last paragraph
              if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim());
              }
              
              // If no clear separation was found, fall back to original text as single paragraph
              if (paragraphs.length === 0) {
                paragraphs.push(text);
              }
              
              const textElements: SVGTextElement[] = [];
              let currentY = y;
              
              // Process each paragraph separately
              paragraphs.forEach((paragraph, paragraphIndex) => {
                if (paragraphIndex > 0) {
                  currentY += lineHeight * 0.5; // Add small gap between paragraphs
                }
                
                // Determine if this paragraph should be rendered as Chinese (raster) or English (vector)
                const chineseChars = (paragraph.match(/[\u4e00-\u9fff]/g) || []).length;
                const totalChars = paragraph.replace(/\s/g, '').length;
                const hasChinese = chineseChars > totalChars * 0.3; // More than 30% Chinese chars
                
                // Use appropriate wrapping function based on paragraph content
                const wrappedLines = hasChinese 
                  ? wrapChineseText(paragraph, maxPixelWidth)
                  : wrapEnglishText(paragraph, maxPixelWidth);
                
                wrappedLines.forEach((line, index) => {
                  // Use a more careful trimming that preserves Chinese punctuation
                  const trimmedLine = line.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
                  if (trimmedLine) {
                    if (hasChinese) {
                      // Render Chinese text as raster image for better font support
                      const imageDataUrl = renderTextAsImage(trimmedLine, 8); // Smaller font size for Chinese
                      if (imageDataUrl && imageDataUrl.length > 100) { // Only add if we got a valid image
                        const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                        imageElement.setAttribute('href', imageDataUrl);
                        imageElement.setAttribute('x', x.toString());
                        imageElement.setAttribute('y', (currentY + (index * lineHeight)).toString());
                        imageElement.setAttribute('width', '280'); // Narrower width to avoid logo
                        imageElement.setAttribute('height', '16'); // Smaller height for smaller font
                        imageElement.setAttribute('preserveAspectRatio', 'xMinYMin meet');
                        // Add directly to SVG since images can't be in textElements array
                        svgClone.appendChild(imageElement);
                      }
                    } else {
                      // Render English text normally as SVG text
                      const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
                      textElement.setAttribute('transform', `translate(${x} ${currentY + (index * lineHeight)})`);
                      textElement.setAttribute('font-family', 'Arial, sans-serif');
                      textElement.setAttribute('font-size', '10px');
                      textElement.setAttribute('fill', 'black');
                      textElement.textContent = trimmedLine;
                      textElements.push(textElement);
                    }
                  }
                });
                
                currentY += wrappedLines.length * lineHeight;
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
              // Process the report text to ensure Chinese punctuation is preserved
              let processedReportText = reportText.trim();
              const { textElements } = addWrappedTextElement(179.27, 590.33, processedReportText);
              textElements.forEach(element => svgClone.appendChild(element));
            }
            
            // Add artwork image if available
            if (artworkUrl) {
              try {
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
                  img.onerror = () => reject(new Error(`Failed to load image from URL: ${url}`));
                  img.src = url;
                });
                
                const dataUrl = await convertUrlToDataUrl(artworkUrl);
                const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                imageElement.setAttribute('href', dataUrl);
                imageElement.setAttribute('x', '97.64');
                imageElement.setAttribute('y', '308.45');
                imageElement.setAttribute('width', '400');
                imageElement.setAttribute('height', '250');
                imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgClone.appendChild(imageElement);
              } catch (error) { 
                console.error('Failed to load artwork image:', error); 
              }
            }
            
            // Add logo to bottom right
            const logoElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
            logoElement.setAttribute('href', nsalogoPng);
            logoElement.setAttribute('x', '460');
            logoElement.setAttribute('y', '680');
            logoElement.setAttribute('width', '80');
            logoElement.setAttribute('height', '80');
            logoElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svgClone.appendChild(logoElement);
            
            // Set SVG attributes with proper encoding
            svgClone.setAttribute('width', '595.28');
            svgClone.setAttribute('height', '841.89');
            svgClone.setAttribute('viewBox', '0 0 595.28 841.89');
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            
            // Add style element for proper font rendering
            const styleElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
            styleElement.textContent = `
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');
              text { 
                fill: black !important; 
                fill-opacity: 1 !important; 
                opacity: 1 !important; 
                color: black !important;
                font-family: 'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', 'SimSun', 'PingFang SC', 'Hiragino Sans GB', Arial, sans-serif !important;
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
            `;
            svgClone.appendChild(styleElement);
            
            
            // Generate PDF with proper encoding
            const pdf = new jsPDF({ 
              orientation: 'portrait', 
              unit: 'pt', 
              format: 'a4',
              compress: true
            });
            
            // Convert SVG to PDF with better Chinese character support
            await svg2pdf(svgClone, pdf, {
              width: 595.28,
              height: 841.89
            });
            
            
            const fileName = `${studentName.replace(/\s+/g, '_')}_report.pdf`;
            pdf.save(fileName);
            
            document.body.removeChild(tempDiv);
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
