import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { TypographySmall } from '@/components/ui/typography';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { getReportsForStudent, createOrUpdateReport, cleanupDuplicateReports } from '@/services/firebaseService';
import { useImageUploadV2 } from '@/hooks/useImageUploadV2';
import { ImageUpload } from '@/components/ui/image-upload';
import { ReportPreview } from '@/components/ReportPreview';
import type { Student, Class, ReportData } from '@/types';

interface StudentCardProps { 
  student: Student; 
  classData: Class; 
  isSelected?: boolean;
  onStudentSelected?: (studentId: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = React.memo(({ student, classData, isSelected, onStudentSelected }) => {
  const [state, setState] = useState({ 
    isOpen: false, 
    loading: false, 
    reports: [] as ReportData[], 
    reportText: '', 
    showAutoSave: false, 
    hasUnsavedChanges: false, 
    generatingAI: false, 
    hasSeenAIWarning: false
  });
  const hasLoadedRef = useRef(false);
  const lastSavedTextRef = useRef('');
  const initializeWithUrlRef = useRef<(url: string | null) => void>(() => {});

  const saveReport = useCallback(async (imageUrl?: string | null, isAutoSave: boolean = false) => {
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
      await createOrUpdateReport(reportData);
      await new Promise(resolve => setTimeout(resolve, isAutoSave ? 500 : 1000));
      
      // Update the last saved text and clear unsaved changes flag
      lastSavedTextRef.current = state.reportText.trim();
      setState(prev => ({ ...prev, showAutoSave: true, hasUnsavedChanges: false }));
      setTimeout(() => setState(prev => ({ ...prev, showAutoSave: false })), isAutoSave ? 1000 : 2000);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Failed to save report. Please try again.');
    }
  }, [state.reportText, student.id, classData.id, classData.teacherEmail]);

  const imageUpload = useImageUploadV2({
    userId: `students/${student.id}`,
    onError: (error) => console.error('Image upload error:', error),
    onRemove: () => saveReport(null),
  });

  // Store the latest initializeWithUrl function in a ref
  initializeWithUrlRef.current = imageUpload.initializeWithUrl;

  // Auto-expand when this student is selected
  useEffect(() => {
    if (isSelected) {
      setState(prev => ({ ...prev, isOpen: true }));
    }
  }, [isSelected]);

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
    if (!state.reportText.trim()) {
      alert('Please enter some notes or ideas first to generate a report.');
      return;
    }

    // If user has already seen the warning, proceed directly
    if (state.hasSeenAIWarning) {
      generateAIReport();
    }
    // Otherwise, the AlertDialog will handle showing the warning
  };

  const generateAIReport = async () => {
    setState(prev => ({ ...prev, generatingAI: true, hasSeenAIWarning: true }));
    
    try {
      // Using OpenAI API (you can replace with any AI service)
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
          content: 'You are a bilingual educator creating student progress reports. Generate a bilingual report with BOTH English and Chinese sections. Format: [English text] [Chinese text]. English section should be conversational and warm. Chinese section should be formal and academic. Focus on student progress, creativity, engagement, and achievements. Use teacher notes as foundation. If notes are Chinese dot points, transform into proper sentences. Keep student names in English in both languages. Each language section must be complete and meaningful. Generate natural, flowing text without section headers. CRITICAL: Your response must be EXACTLY 400 characters or less. Count characters as you write. If your first attempt exceeds 400 characters, revise and shorten it. If still too long, revise again. Keep revising until it fits within 400 characters. This is for a printed certificate with limited space.'
        },
            {
              role: 'user',
              content: `Student: ${student.firstName} ${student.lastName}\nClass: ${classData.classLevel}\nBullets: ${state.reportText}`
            }
          ],
          max_tokens: 800,
          temperature: 0.6
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI report');
      }

      const data = await response.json();
      let generatedText = data.choices[0]?.message?.content?.trim();
      
      // DEBUG: Log raw AI output
      console.log('🔍 DEBUG: Raw AI output:', generatedText);
      console.log('🔍 DEBUG: Raw output length:', generatedText?.length);
      
      if (generatedText) {
        // Clean up any unwanted formatting
        generatedText = generatedText
          .replace(/\[.*?\]/g, '')
          .trim();
        
        // DEBUG: Log after cleaning
        console.log('🔍 DEBUG: After cleaning:', generatedText);
        console.log('🔍 DEBUG: Cleaned length:', generatedText.length);
        
        // AI handles character limit - no truncation needed
        
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


  // Auto-save effect with unsaved changes tracking
  useEffect(() => {
    if (!state.reportText.trim()) {
      setState(prev => ({ ...prev, hasUnsavedChanges: false }));
      return;
    }
    
    // Check if there are unsaved changes
    const hasChanges = state.reportText.trim() !== lastSavedTextRef.current;
    setState(prev => ({ ...prev, hasUnsavedChanges: hasChanges }));
    
    if (!hasChanges) return;
    
    const timeoutId = setTimeout(() => {
      if (!imageUpload.uploading) saveReport(imageUpload.currentImageUrl, true);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [state.reportText, imageUpload.uploading, imageUpload.currentImageUrl, saveReport]);

  // beforeunload event handler to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.hasUnsavedChanges]);

  return (
    <Card 
      className="w-full"
      data-student-id={student.id}
    >
      <Collapsible open={state.isOpen}>
        <CardHeader className="p-0">
          <div 
            className="flex items-center justify-between p-6"
            onClick={(e) => {
              // Only allow clicks on the specific clickable area
              if (!e.target || !(e.target as Element).closest('[role="button"]')) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <div 
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors p-2 -m-2 rounded"
              role="button"
              tabIndex={0}
              aria-expanded={state.isOpen}
              aria-label={`${state.isOpen ? 'Collapse' : 'Expand'} student details for ${student.firstName} ${student.lastName}`}
              onClick={() => {
                if (onStudentSelected) {
                  onStudentSelected(student.id);
                }
                handleToggle();
              }}
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
              {state.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle>{student.firstName} {student.lastName}</CardTitle>
            </div>
          </div>
        </CardHeader>
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
          {state.reportText.length}/430 characters
        </TypographySmall>
                  </div>
                  <Textarea
                    id="report"
                    value={state.reportText}
        onChange={(e) => {
          const value = e.target.value;
          // Limit to 430 characters
          if (value.length <= 430) {
            setState(prev => ({ 
              ...prev, 
              reportText: value, 
              hasUnsavedChanges: true
            }));
          }
        }}
                    placeholder="Write your report here or enter notes/bullet points for AI generation..."
                    className="min-h-[150px]"
                    maxLength={430}
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <TypographySmall className={`transition-opacity duration-200 ${
                    state.showAutoSave 
                      ? 'text-green-600 opacity-100' 
                      : state.hasUnsavedChanges 
                        ? 'text-orange-600 opacity-100' 
                        : 'text-muted-foreground opacity-0'
                  }`}>
                    {state.showAutoSave 
                      ? '✓ Saved' 
                      : state.hasUnsavedChanges 
                        ? '● Unsaved changes' 
                        : 'Auto-saves as you type'
                    }
                  </TypographySmall>
                  {state.hasUnsavedChanges && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => saveReport(imageUpload.currentImageUrl, false)}
                      className="text-xs"
                    >
                      Save Now
                    </Button>
                  )}
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
                  <ReportPreview
                    student={student}
                    classData={classData}
                    reportData={state.reports.length > 0 ? state.reports[0] : undefined}
                    reportText={state.reportText}
                    artworkUrl={imageUpload.uploading ? null : imageUpload.currentImageUrl}
                    isImageUploading={imageUpload.uploading}
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