import { useState, useEffect } from 'react';
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
import { getTeacherByEmail } from '@/services/firebaseService-ultra-final';
import { isReportReadyForPDF } from '@/services/pdfGenerationService';
import type { Student, Class, ReportData, Teacher } from '@/types';
import { fetchSvgTemplate, convertUrlToDataUrl, injectReportIntoSvg, svgToPng } from '@/services/reportSvg';
// PDF generation is now handled server-side via Netlify function

interface ReportPreviewProps {
  student: Student;
  classData: Class;
  reportData?: ReportData;
  reportText: string;
  artworkUrl?: string | null;
  isImageUploading?: boolean;
}

export function ReportPreview({
  student,
  classData,
  reportData,
  reportText,
  artworkUrl,
  isImageUploading = false
}: ReportPreviewProps) {
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

  const generatePngPreview = async () => {
    if (!teacher) return;
    setGeneratingPng(true);
    setPreviewError(null); // Clear any previous errors
    toast.info('Generating report preview...', { duration: 2000 });
    try {
      const svgText = await fetchSvgTemplate(reportTemplateSvg);
      const artworkDataUrl = artworkUrl ? await convertUrlToDataUrl(artworkUrl) : undefined;
      const svgString = injectReportIntoSvg(svgText, {
        studentName,
        classLevel: classData.classLevel,
        classLocation: classData.classLocation,
        teacherName,
        date,
        reportText: reportText?.trim() || '',
        artworkDataUrl
      });
      const png = await svgToPng(svgString, { scale: 300 / 72 });
      setPngDataUrl(png);
      setPreviewError(null);
      setGeneratingPng(false);
      toast.success('Preview ready', { duration: 2000 });
    } catch (error) {
      console.error('Error generating PNG preview:', error);
      setGeneratingPng(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate preview';
      setPreviewError(errorMessage);
      toast.error('Failed to generate preview', {
        description: errorMessage,
        duration: 4000
      });
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
            const svgText = await fetchSvgTemplate(reportTemplateSvg);
            const artworkDataUrl = artworkUrl ? await convertUrlToDataUrl(artworkUrl) : undefined;
            const svgString = injectReportIntoSvg(svgText, {
              studentName,
              classLevel: classData.classLevel,
              classLocation: classData.classLocation,
              teacherName,
              date,
              reportText: reportText?.trim() || '',
              artworkDataUrl
            });
            
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
}

export default ReportPreview;
