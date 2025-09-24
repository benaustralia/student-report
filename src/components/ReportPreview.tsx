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
        <div className="flex-1 overflow-auto p-4">
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
            
            // Add text elements (simplified version)
            const addTextElement = (x: number, y: number, text: string) => {
              const textElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
              textElement.setAttribute('transform', `translate(${x} ${y})`);
              textElement.setAttribute('font-family', 'Arial, sans-serif');
              textElement.setAttribute('fill', 'black');
              textElement.textContent = text;
              return textElement;
            };
            
            // Add student data
            svgClone.appendChild(addTextElement(206.17, 222.41, studentName));
            svgClone.appendChild(addTextElement(206.17, 250.43, classData.classLevel));
            svgClone.appendChild(addTextElement(206.44, 278.45, classData.classLocation));
            svgClone.appendChild(addTextElement(327.71, 727.44, teacherName));
            svgClone.appendChild(addTextElement(327.71, 745.52, date));
            
            if (reportText?.trim()) {
              svgClone.appendChild(addTextElement(179.27, 590.33, reportText));
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
                imageElement.setAttribute('x', '97.64'); // Centered: (595.28 - 400) / 2
                imageElement.setAttribute('y', '308.45'); // Below class location
                imageElement.setAttribute('width', '400');
                imageElement.setAttribute('height', '250');
                imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgClone.appendChild(imageElement);
              } catch (error) { 
                console.error('Failed to load artwork image:', error); 
              }
            }
            
            // Set SVG attributes
            svgClone.setAttribute('width', '595.28');
            svgClone.setAttribute('height', '841.89');
            svgClone.setAttribute('viewBox', '0 0 595.28 841.89');
            
            // Generate PDF
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            await svg2pdf(svgClone, pdf);
            
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
