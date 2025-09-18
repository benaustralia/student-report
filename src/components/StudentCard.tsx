import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getReportsForStudent, createOrUpdateReport, cleanupDuplicateReports } from '@/services/firebaseService';
import { useImageUploadV2 } from '@/hooks/useImageUploadV2';
import { ImageUpload } from '@/components/ui/image-upload';
import { ReportPreview } from '@/components/ReportPreview';
import type { Student, Class, ReportData } from '@/types';

interface StudentCardProps {
  student: Student;
  classData: Class;
  user: any; // User from Firebase Auth
  isAdmin?: boolean;
}

export const StudentCard: React.FC<StudentCardProps> = ({ 
  student, 
  classData, 
  user
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [_reports, setReports] = useState<ReportData[]>([]);
  const [reportText, setReportText] = useState('');
  const [showAutoSave, setShowAutoSave] = useState(false);
  const hasLoadedRef = useRef(false);

  // Image upload hook
  const imageUpload = useImageUploadV2({
    userId: `students/${student.id}`,
    onError: (error) => {
      console.error('Image upload error:', error);
    },
    onRemove: () => {
      // Auto-save when image is removed
      saveReport(null);
    },
  });

  // Auto-upload when file is set
  useEffect(() => {
    if (imageUpload.file) {
      imageUpload.upload().then((imageUrl) => {
        if (imageUrl) {
          saveReport(imageUrl);
        }
      });
    }
  }, [imageUpload.file]);

  const loadReports = useCallback(async () => {
    if (hasLoadedRef.current) {
      return;
    }
    
    hasLoadedRef.current = true;
    setLoading(true);
    try {
      // First, clean up any duplicate reports for this student
      await cleanupDuplicateReports(student.id);
      
      const reportsData = await getReportsForStudent(student.id);
      setReports(reportsData);
      
      // If there's an existing report, populate the form
      if (reportsData.length > 0) {
        const latestReport = reportsData[0]; // Most recent report
        setReportText(latestReport.reportText || '');
        imageUpload.initializeWithUrl(latestReport.artworkUrl || null);
      } else {
        // No reports, clear the form
        setReportText('');
        imageUpload.initializeWithUrl(null);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }, [student.id]);

  // Clean up duplicates and load reports when component mounts
  useEffect(() => {
    hasLoadedRef.current = false; // Reset when student changes
    loadReports();
  }, [loadReports]);

  const handleToggle = () => {
    if (!isOpen) {
      loadReports();
    }
    setIsOpen(!isOpen);
  };

  const saveReport = async (imageUrl?: string | null, isAutoSave: boolean = false) => {
    if (!reportText.trim() && !imageUrl) return;
    
    try {
      const reportData = {
        studentId: student.id,
        classId: classData.id,
        teacherEmail: user.email || '',
        reportText: reportText.trim(),
        ...(imageUrl && { artworkUrl: imageUrl })
      };

      await createOrUpdateReport(reportData);
      
      // Wait a moment for the database to be updated (shorter for auto-save)
      await new Promise(resolve => setTimeout(resolve, isAutoSave ? 500 : 1000));
      
      // Only reload if this was a manual save (not auto-save)
      if (!isAutoSave) {
        hasLoadedRef.current = false;
        await loadReports();
      }
      
      // Show auto-save flash message (less intrusive for auto-save)
      setShowAutoSave(true);
      setTimeout(() => setShowAutoSave(false), isAutoSave ? 1000 : 2000);

    } catch (error) {
      console.error('Error saving report:', error);
      alert('Failed to save report. Please try again.');
    }
  };

  // Auto-save when text changes (with debounce)
  useEffect(() => {
    if (!reportText.trim()) return;
    
    const timeoutId = setTimeout(() => {
      // Only auto-save if we're not currently uploading
      if (!imageUpload.uploading) {
        saveReport(imageUpload.currentImageUrl, true); // Pass isAutoSave = true
      }
    }, 2000); // Auto-save after 2 seconds of no typing
    
    return () => clearTimeout(timeoutId);
  }, [reportText, imageUpload.uploading]);


  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleToggle}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-base">
                  {student.firstName} {student.lastName}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading report...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Image Upload */}
                <div className="space-y-2">
                  <Label>Artwork</Label>
                  <ImageUpload
                    value={imageUpload.preview}
                    onChange={(file, preview) => {
                      if (file) {
                        imageUpload.setFile(file);
                        imageUpload.setPreview(preview);
                        // Upload will be triggered by useEffect when file state updates
                      } else {
                        imageUpload.setFile(null);
                        imageUpload.setPreview(null);
                      }
                    }}
                    onRemove={() => {
                      imageUpload.remove();
                    }}
                    disabled={imageUpload.uploading}
                    maxSize={5}
                    acceptedTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
                  />
                </div>

                {/* Report Text */}
                <div className="space-y-2">
                  <Label htmlFor="report">Report</Label>
                  <Textarea
                    id="report"
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Write your report here..."
                    className="min-h-[100px]"
                  />
                </div>

                {/* Auto-save message */}
                <div className="flex justify-center pt-2">
                  <div className={`text-xs transition-opacity duration-200 ${
                    showAutoSave 
                      ? 'text-green-600 opacity-100' 
                      : 'text-muted-foreground opacity-0'
                  }`}>
                    {showAutoSave ? '✓ Saved' : 'Auto-saves as you type'}
                  </div>
                </div>

                {/* Preview Button */}
                <div className="pt-4">
                  <ReportPreview
                    student={student}
                    classData={classData}
                    reportData={_reports.length > 0 ? _reports[0] : undefined}
                    reportText={reportText}
                    artworkUrl={imageUpload.preview}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};