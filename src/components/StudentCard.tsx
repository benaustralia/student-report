import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypographySmall } from '@/components/ui/typography';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getReportsForStudent, createOrUpdateReport, cleanupDuplicateReports, getTeacherByEmail } from '@/services/firebaseService-ultra-final';
import { useImageUploadV2 } from '@/hooks/useImageUploadV2';
import { ImageUpload } from '@/components/ui/image-upload';
import { generatePDFInBackground } from '@/services/pdfGenerationService';
import type { Student, Class, ReportData } from '@/types';

// Lazy load heavy components
const ReportPreview = lazy(() => import('@/components/ReportPreview').then(m => ({ default: m.ReportPreview })));
const FeedbackViewer = lazy(() => import('@/components/FeedbackViewer').then(m => ({ default: m.FeedbackViewer })));

interface StudentCardProps { 
  student: Student; 
  classData: Class; 
  isSelected?: boolean;
  onStudentSelected?: (studentId: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = React.memo(({ student, classData, isSelected, onStudentSelected }) => {
  const [state, setState] = useState({ isOpen: false, loading: false, reports: [] as ReportData[], reportText: '', hasUnsavedChanges: false, generatingAI: false, hasSeenAIWarning: false });
  const hasLoadedRef = useRef(false);
  const lastSavedTextRef = useRef('');
  const initializeWithUrlRef = useRef<(url: string | null) => void>(() => {});

  const saveReport = useCallback(async (imageUrl?: string | null, isAutoSave = false) => {
    if (!state.reportText.trim() && !imageUrl) return;
    try {
      const reportData = {
        studentId: student.id,
        classId: classData.id,
        teacherEmail: classData.teacherEmail,
        reportText: state.reportText.trim(),
        studentName: `${student.firstName} ${student.lastName}`,
        ...(imageUrl && { artworkUrl: imageUrl })
      };
      const reportId = await createOrUpdateReport(reportData);
      
      lastSavedTextRef.current = state.reportText.trim();
      setState(prev => ({ ...prev, hasUnsavedChanges: false }));
      toast.success(isAutoSave ? 'Report auto-saved' : 'Report saved successfully', { duration: isAutoSave ? 2000 : 3000 });
      window.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'reports' } }));
      
      try {
        const savedReports = await getReportsForStudent(student.id);
        const savedReport = savedReports.find(r => r.id === reportId) || savedReports[0];
        if (savedReport) {
          const teacher = await getTeacherByEmail(classData.teacherEmail);
          if (teacher) generatePDFInBackground(savedReport, student, classData, teacher).catch(console.error);
        }
      } catch (pdfError) {
        console.error('Failed to trigger PDF generation:', pdfError);
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Failed to save report. Please try again.');
    }
  }, [state.reportText, student.id, classData.id, classData.teacherEmail, student]);

  const imageUpload = useImageUploadV2({
    userId: `students/${student.id}`,
    onError: console.error,
    onRemove: () => saveReport(null),
  });

  initializeWithUrlRef.current = imageUpload.initializeWithUrl;

  useEffect(() => { if (isSelected) setState(prev => ({ ...prev, isOpen: true })); }, [isSelected]);

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
        const reportText = latestReport.reportText || '';
        setState(prev => ({ ...prev, reportText, hasUnsavedChanges: false }));
        lastSavedTextRef.current = reportText;
        initializeWithUrlRef.current(latestReport.artworkUrl || null);
      } else {
        setState(prev => ({ ...prev, reportText: '', hasUnsavedChanges: false }));
        lastSavedTextRef.current = '';
        initializeWithUrlRef.current(null);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [student.id]);

  useEffect(() => {
    if (imageUpload.file) {
      imageUpload.upload().then((imageUrl) => {
        if (imageUrl) saveReport(imageUrl);
      });
    }
  }, [imageUpload.file, saveReport]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadReports();
    }
  }, [loadReports]);

  const handleToggle = () => {
    if (!state.isOpen) loadReports();
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  };

  const handleAIGenerate = () => {
    if (!state.reportText.trim()) return alert('Please enter some notes or ideas first to generate a report.');
    if (state.hasSeenAIWarning) generateAIReport();
  };

  const generateAIReport = async () => {
    setState(prev => ({ ...prev, generatingAI: true, hasSeenAIWarning: true }));
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || 'your-api-key-here'}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a bilingual educator in Australia creating student progress reports. Generate a bilingual report with BOTH English and Chinese sections. Format: [English text] [Chinese text]. Both sections should be casual, warm-hearted, and friendly - like talking to parents. The Chinese section should match the conversational, warm tone of English (like chatting with friends, not a formal academic report). Avoid overly formal or academic language. Focus on student progress, creativity, engagement, and achievements with genuine warmth. Use teacher notes as foundation. If notes are Chinese dot points, transform into proper sentences. Keep student names in English in both languages. Each language section must be complete and meaningful. Generate natural, flowing text without section headers. CRITICAL: Your response MUST be EXACTLY 430 characters or less (no exceptions). This is a hard limit for a printed certificate. Count characters as you write. Target: ~200 English chars + ~200 Chinese chars = ~400 total. Write concisely. Shorten immediately if over limit.'
            },
            {
              role: 'user',
              content: `Student: ${student.firstName} ${student.lastName}\nClass: ${classData.classLevel}\nBullets: ${state.reportText}`
            }
          ],
          max_tokens: 120,
          temperature: 0.2
        })
      });

      if (!response.ok) throw new Error('Failed to generate AI report');

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content?.trim().replace(/\[.*?\]/g, '').trim();
      
      if (generatedText) {
        setState(prev => ({ ...prev, reportText: generatedText, hasUnsavedChanges: true }));
      } else {
        alert('Failed to generate report text. Please try again.');
      }
    } catch (error) {
      console.error('Error generating AI report:', error);
      alert('Failed to generate AI report. Please check your API key or try again.');
    } finally {
      setState(prev => ({ ...prev, generatingAI: false }));
    }
  };


  useEffect(() => {
    if (!state.reportText.trim()) {
      if (state.hasUnsavedChanges) setState(prev => ({ ...prev, hasUnsavedChanges: false }));
      return;
    }
    
    const hasChanges = state.reportText.trim() !== lastSavedTextRef.current;
    if (hasChanges !== state.hasUnsavedChanges) setState(prev => ({ ...prev, hasUnsavedChanges: hasChanges }));
    if (!hasChanges) return;
    
    const timeoutId = setTimeout(() => {
      if (!imageUpload.uploading) saveReport(imageUpload.currentImageUrl, true);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [state.reportText, state.hasUnsavedChanges, imageUpload.uploading, imageUpload.currentImageUrl, saveReport]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!state.hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.hasUnsavedChanges]);

  return (
    <Card 
      className="w-full"
      data-student-id={student.id}
    >
      <Collapsible open={state.isOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => {
              if (onStudentSelected) {
                onStudentSelected(student.id);
              }
              handleToggle();
            }}
            role="button"
            tabIndex={0}
            aria-expanded={state.isOpen}
            aria-label={`${state.isOpen ? 'Collapse' : 'Expand'} student details for ${student.firstName} ${student.lastName}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onStudentSelected) {
                  onStudentSelected(student.id);
                }
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
                    maxSize={20}
                    acceptedTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
                  />
                  {imageUpload.uploading && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading image... Please wait before previewing report.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="report">Report</Label>
        <TypographySmall         className={`${
          state.reportText.length >= 340 
            ? 'text-green-600' 
            : state.reportText.length >= 215 
              ? 'text-yellow-600' 
              : 'text-muted-foreground'
        }`}>
          {state.reportText.length}/430 characters {state.reportText.length > 430 && '(over limit)'}
        </TypographySmall>
                  </div>
                  <Textarea
                    id="report"
                    value={state.reportText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setState(prev => ({ 
                        ...prev, 
                        reportText: value
                      }));
                    }}
                    placeholder="Write your report here or enter notes/bullet points for AI generation..."
                    className="min-h-[150px]"
                  />
                </div>
                <div className="pt-4 space-y-2">
                  <div className="flex justify-end">
                    {state.hasSeenAIWarning ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={generateAIReport}
                        disabled={state.generatingAI || !state.reportText.trim()}
                        className="text-xs w-full sm:w-auto"
                      >
                        {state.generatingAI ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI support
                          </>
                        )}
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleAIGenerate}
                            disabled={state.generatingAI || !state.reportText.trim()}
                            className="text-xs w-full sm:w-auto"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI support
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white border shadow-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle>AI Support Warning</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-gray-600 leading-relaxed">
                              AI support will completely overwrite your current text with a new AI-generated report. Your existing text will be lost.
                              <br /><br />
                              <span className="font-medium text-gray-800">点击"AI生成"将覆盖原文，现有文本将被替换。</span>
                              <br /><br />
                              Are you sure you want to continue?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={generateAIReport}>
                              Continue
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Suspense fallback={<Button size="sm" variant="outline" className="w-full sm:w-auto" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>}>
                      <FeedbackViewer 
                        teacherEmail={classData.teacherEmail}
                        trigger={
                          <Button size="sm" variant="outline" className="w-full sm:w-auto">
                            📌 Corkboard
                          </Button>
                        }
                      />
                    </Suspense>
                  </div>
                  <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                    <ReportPreview
                      student={student}
                      classData={classData}
                      reportData={state.reports.length > 0 ? state.reports[0] : undefined}
                      reportText={state.reportText}
                      artworkUrl={imageUpload.uploading ? null : imageUpload.currentImageUrl}
                      isImageUploading={imageUpload.uploading}
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});