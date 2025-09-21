import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypographySmall } from '@/components/ui/typography';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getReportsForStudent, createOrUpdateReport, cleanupDuplicateReports } from '@/services/firebaseService';
import { useImageUploadV2 } from '@/hooks/useImageUploadV2';
import { ImageUpload } from '@/components/ui/image-upload';
import { ReportPreview } from '@/components/ReportPreview';
import type { Student, Class, ReportData } from '@/types';

interface StudentCardProps { student: Student; classData: Class; isAdmin?: boolean; }

export const StudentCard: React.FC<StudentCardProps> = React.memo(({ student, classData }) => {
  const [state, setState] = useState({ isOpen: false, loading: false, reports: [] as ReportData[], reportText: '', showAutoSave: false });
  const hasLoadedRef = useRef(false);

  const imageUpload = useImageUploadV2({
    userId: `students/${student.id}`,
    onError: (error) => console.error('Image upload error:', error),
    onRemove: () => saveReport(null),
  });

  useEffect(() => {
    if (imageUpload.file) {
      imageUpload.upload().then((imageUrl) => {
        if (imageUrl) saveReport(imageUrl);
      });
    }
  }, [imageUpload.file]);

  const loadReports = useCallback(async () => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setState(prev => ({ ...prev, loading: true }));
    try {
      await cleanupDuplicateReports(student.id);
      const reportsData = await getReportsForStudent(student.id);
      setState(prev => ({ ...prev, reports: reportsData }));
      if (reportsData.length > 0) {
        const latestReport = reportsData[0];
        setState(prev => ({ ...prev, reportText: latestReport.reportText || '' }));
        imageUpload.initializeWithUrl(latestReport.artworkUrl || null);
      } else {
        setState(prev => ({ ...prev, reportText: '' }));
        imageUpload.initializeWithUrl(null);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [student.id]);

  useEffect(() => {
    hasLoadedRef.current = false;
    loadReports();
  }, [loadReports]);

  const handleToggle = () => {
    if (!state.isOpen) loadReports();
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  };

  const saveReport = async (imageUrl?: string | null, isAutoSave: boolean = false) => {
    if (!state.reportText.trim() && !imageUrl) return;
    try {
      const reportData = {
        studentId: student.id,
        classId: classData.id,
        teacherEmail: classData.teacherEmail,
        reportText: state.reportText.trim(),
        ...(imageUrl && { artworkUrl: imageUrl })
      };
      await createOrUpdateReport(reportData);
      await new Promise(resolve => setTimeout(resolve, isAutoSave ? 500 : 1000));
      if (!isAutoSave) {
        hasLoadedRef.current = false;
        await loadReports();
      }
      setState(prev => ({ ...prev, showAutoSave: true }));
      setTimeout(() => setState(prev => ({ ...prev, showAutoSave: false })), isAutoSave ? 1000 : 2000);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Failed to save report. Please try again.');
    }
  };

  useEffect(() => {
    if (!state.reportText.trim()) return;
    const timeoutId = setTimeout(() => {
      if (!imageUpload.uploading) saveReport(imageUpload.currentImageUrl, true);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [state.reportText, imageUpload.uploading]);

  return (
    <Card className="w-full">
      <Collapsible open={state.isOpen} onOpenChange={(open) => setState(prev => ({ ...prev, isOpen: open }))}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors" 
            onClick={handleToggle}
            role="button"
            tabIndex={0}
            aria-expanded={state.isOpen}
            aria-label={`${state.isOpen ? 'Collapse' : 'Expand'} student details for ${student.firstName} ${student.lastName}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle();
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {state.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle>{student.firstName} {student.lastName}</CardTitle>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {state.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading report...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Artwork</Label>
                  <ImageUpload
                    value={imageUpload.preview}
                    onChange={(file, preview) => {
                      if (file) {
                        imageUpload.setFile(file);
                        imageUpload.setPreview(preview);
                      } else {
                        imageUpload.setFile(null);
                        imageUpload.setPreview(null);
                      }
                    }}
                    onRemove={() => imageUpload.remove()}
                    disabled={imageUpload.uploading}
                    maxSize={5}
                    acceptedTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report">Report</Label>
                  <Textarea
                    id="report"
                    value={state.reportText}
                    onChange={(e) => setState(prev => ({ ...prev, reportText: e.target.value }))}
                    placeholder="Write your report here..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex justify-center pt-2">
                  <TypographySmall className={`transition-opacity duration-200 ${state.showAutoSave ? 'text-green-600 opacity-100' : 'text-muted-foreground opacity-0'}`}>
                    {state.showAutoSave ? '✓ Saved' : 'Auto-saves as you type'}
                  </TypographySmall>
                </div>
                <div className="pt-4">
                  <ReportPreview
                    student={student}
                    classData={classData}
                    reportData={state.reports.length > 0 ? state.reports[0] : undefined}
                    reportText={state.reportText}
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
});