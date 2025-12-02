import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatisticItem } from '@/components/ui/statistic-item';
import { ChevronDown, ChevronRight, Users, Download, UserPlus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getStudentsForClass, getReportsForClass, getTeacherByEmail, getStudentCountsForClasses, updateReport } from '@/services/firebaseService-ultra-final';
import { refreshDownloadURL } from '@/services/storageService';
import { formatStudentName } from '@/lib/utils';
import type { Class, Student } from '@/types';
import { StudentCard } from './StudentCard';
import { ClassStudentManagementModal } from './ClassStudentManagementModal';
import { generateClassZIP, type ClassReport, type ZIPGenerationResult } from '@/services/zipService';
import { isReportReadyForPDF, generatePDFInBackground } from '@/services/pdfGenerationService';

interface ClassCardProps {
  classData: Class;
  selectedStudentId?: string | null;
  onStudentSelected?: (studentId: string) => void;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export const ClassCard: React.FC<ClassCardProps> = React.memo(({ classData, selectedStudentId, onStudentSelected, isOpen: externalIsOpen, onToggle }) => {
  const DEBUG = false;
  const [students, setStudents] = useState<Student[]>([]);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onToggle || setInternalIsOpen;

  const loadStudents = async (forceReload = false) => {
    if (students.length > 0 && !forceReload) return; // Already loaded, unless forced
    
    setLoading(true);
    try {
      if (DEBUG) console.log('[class] loadStudents', { classId: classData.id });
      const studentsData = await getStudentsForClass(classData.id);
      setStudents(studentsData);
      setStudentCount(studentsData.length);
      setHasLoadedStudents(true);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentCount = React.useCallback(async () => {
    try {
      const counts = await getStudentCountsForClasses([classData.id]);
      setStudentCount(counts[classData.id] || 0);
    } catch (error) {
      console.error('Error loading student count:', error);
      setStudentCount(0);
    }
  }, [classData.id]);

  // Load student count on mount to show accurate count - optimized
  React.useEffect(() => {
    loadStudentCount();
  }, [loadStudentCount]);

  // Listen for data changes from DataBuilder to refresh student count and list
  React.useEffect(() => {
    const handleDataChange = async (event: CustomEvent) => {
      const { type, action, itemId } = event.detail || {};
      
      // Only refresh when students are added/updated/deleted
      if (type === 'students') {
        if (action === 'delete' && itemId && hasLoadedStudents) {
          // For deletions, just remove the specific student from local state
          // This preserves the state of other StudentCard components
          setStudents(prev => prev.filter(student => student.id !== itemId));
          setStudentCount(prev => Math.max(0, (prev || 0) - 1));
        } else if (action === 'bulk_import' && hasLoadedStudents) {
          // For bulk imports, reload the full list to show new students
          loadStudentCount();
          setTimeout(() => {
            loadStudents(true);
          }, 100);
        } else if (action === 'refresh' && hasLoadedStudents) {
          // Force refresh when modal closes
          loadStudentCount();
          setTimeout(() => {
            loadStudents(true);
          }, 100);
        } else if (action !== 'delete' && action !== 'bulk_import' && action !== 'refresh') {
          // For other additions/updates, reload the full list
          loadStudentCount();
          if (hasLoadedStudents) {
            setTimeout(() => {
              loadStudents(true);
            }, 100);
          }
        }
      }
      
      // Also listen for request approvals that might affect this class
      if (type === 'requests' && action === 'approve') {
        // Refresh student count and list when any request is approved
        // This ensures we catch student additions/removals from other sessions
        if (hasLoadedStudents) {
          loadStudentCount();
          setTimeout(() => {
            loadStudents(true);
          }, 100);
        }
      }
    };

    window.addEventListener('dataChanged', handleDataChange as unknown as EventListener);
    return () => window.removeEventListener('dataChanged', handleDataChange as unknown as EventListener);
  }, [loadStudentCount, hasLoadedStudents]);

  // Auto-expand if this class contains the selected student
  useEffect(() => {
    if (selectedStudentId && students.some(student => student.id === selectedStudentId)) {
      setIsOpen(true);
    }
  }, [selectedStudentId, students]);

  // Listen for class expansion events
  useEffect(() => {
    const handleExpandClass = async (event: CustomEvent) => {
      const { classId, studentId } = event.detail;
      
      // If specific classId is provided, only expand that class
      if (classId && classId === classData.id) {
        setIsOpen(true);
        if (students.length === 0) {
          loadStudents(true);
        }
        return;
      }
      
      // If only studentId is provided, check if this class contains the student
      if (studentId && !classId) {
        try {
          const classStudents = await getStudentsForClass(classData.id);
          if (classStudents.some(student => student.id === studentId)) {
            setIsOpen(true);
            if (students.length === 0) {
              loadStudents(true);
            }
          }
        } catch (error) {
          console.error('Error checking students for class:', error);
        }
      }
    };

    window.addEventListener('expandClassForStudent', handleExpandClass as unknown as EventListener);
    return () => window.removeEventListener('expandClassForStudent', handleExpandClass as unknown as EventListener);
  }, [classData.id, students.length, loadStudents]);

  // When class is open and students are loaded, prepare missing PDFs in background
  useEffect(() => {
    const maybePrepare = async () => {
      if (!isOpen || !hasLoadedStudents) return;
      try {
        if (DEBUG) console.log('[class] maybePrepare:start', { classId: classData.id });
        const [reports, teacher] = await Promise.all([
          getReportsForClass(classData.id),
          getTeacherByEmail(classData.teacherEmail)
        ]);
        // Clean up invalid artworkUrl fields - aggressively clean up invalid URLs
        // This prevents 404 errors on subsequent loads by removing invalid URLs from database
        await Promise.all(
          reports.map(async (r) => {
            if (!r.artworkUrl) return;
            
            // Skip if URL already has a token (it's valid and fresh)
            if (r.artworkUrl.includes('token=')) return;
            
            try {
              // Try to refresh - if it returns null, the file doesn't exist
              const fresh = await refreshDownloadURL(r.artworkUrl);
              if (fresh && fresh !== r.artworkUrl) {
                // URL refreshed successfully - update it
                await updateReport(r.id, { artworkUrl: fresh });
              } else if (!fresh) {
                // File doesn't exist - immediately clear the invalid URL from database
                // This prevents future 404 errors on next load
                await updateReport(r.id, { artworkUrl: undefined });
                if (DEBUG) console.log('[class] maybePrepare:cleared-invalid-artwork', { reportId: r.id });
                // Trigger PDF cleanup since report no longer has artwork
                const updatedReport = { ...r, artworkUrl: undefined };
                if (effectiveTeacher) {
                  const student = students.find(s => s.id === r.studentId);
                  if (student) {
                    generatePDFInBackground(updatedReport, student, classData, effectiveTeacher).catch(err => {
                      if (DEBUG) console.warn('[class] maybePrepare:pdf-cleanup-failed', { reportId: r.id, error: err });
                    });
                  }
                }
              }
            } catch (error: any) {
              // If refresh fails with object-not-found or 404, clear the URL
              if (error?.code === 'storage/object-not-found' || 
                  error?.message?.includes('object-not-found') || 
                  error?.message?.includes('404')) {
                await updateReport(r.id, { artworkUrl: undefined });
                if (DEBUG) console.log('[class] maybePrepare:cleared-invalid-artwork-error', { reportId: r.id });
                // Trigger PDF cleanup since report no longer has artwork
                const updatedReport = { ...r, artworkUrl: undefined };
                if (effectiveTeacher) {
                  const student = students.find(s => s.id === r.studentId);
                  if (student) {
                    generatePDFInBackground(updatedReport, student, classData, effectiveTeacher).catch(err => {
                      if (DEBUG) console.warn('[class] maybePrepare:pdf-cleanup-failed', { reportId: r.id, error: err });
                    });
                  }
                }
              } else if (DEBUG) {
                // Only log unexpected errors
                console.warn('[class] maybePrepare:artwork-refresh-error', { reportId: r.id, error });
              }
            }
          })
        );
        const effectiveTeacher = teacher || {
          id: 'unknown',
          email: classData.teacherEmail,
          firstName: classData.teacherFirstName || (classData.teacherEmail?.split('@')[0] || 'Unknown'),
          lastName: classData.teacherLastName || 'Teacher',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        if (!teacher && DEBUG) console.log('[class] maybePrepare:teacher-fallback', { email: classData.teacherEmail });
        const checkPdfExists = async (pdfUrl?: string) => {
          if (!pdfUrl) return false;
          try {
            // refreshDownloadURL is now statically imported
            // Suppress 404 errors - they're expected for missing files
            const url = await refreshDownloadURL(pdfUrl);
            if (!url) return false; // File doesn't exist
            const res = await fetch(url, { method: 'HEAD' });
            return res.ok;
          } catch (error: any) {
            // Silently handle 404s and other expected errors for missing files
            if (error?.code === 'storage/object-not-found' || error?.message?.includes('404')) {
              return false;
            }
            // Only log unexpected errors
            if (DEBUG) console.warn('[class] checkPdfExists:unexpected-error', error);
            return false;
          }
        };
        const existence = await Promise.all(reports.map(r => checkPdfExists(r.pdfUrl)));
        const total = reports.length;
        const prepared = existence.filter(Boolean).length;
        const toPrepare = reports.filter((r, i) => !existence[i] && isReportReadyForPDF(r)).length;
        if (DEBUG) console.log('[class] maybePrepare:counts', { total, prepared, toPrepare });
        // Removed toast to prevent scroll disruption when opening class
        await Promise.all(
          reports.map(async (r, i) => {
            if (r.pdfUrl && !existence[i]) {
              try { await updateReport(r.id, { pdfUrl: undefined }); } catch {}
              if (DEBUG) console.log('[class] maybePrepare:cleared-stale', { reportId: r.id });
            }
          })
        );
        reports
          .filter(r => {
            const ready = isReportReadyForPDF(r);
            const hasPdfUrl = !!r.pdfUrl;
            if (DEBUG && !ready) {
              console.log('[class] maybePrepare:skip-not-ready', {
                reportId: r.id,
                hasText: !!r.reportText?.trim(),
                hasImage: !!r.artworkUrl?.trim()
              });
            }
            return ready && !hasPdfUrl;
          })
          .forEach(r => {
            const student = students.find(s => s.id === r.studentId);
            if (student && effectiveTeacher) {
              if (DEBUG) console.log('[class] maybePrepare:trigger-bg', {
                reportId: r.id,
                student: `${student.firstName} ${student.lastName}`
              });
              generatePDFInBackground(r, student, classData, effectiveTeacher);
            } else {
              if (DEBUG) console.warn('[class] maybePrepare:skip-bg-trigger', {
                reportId: r.id,
                studentFound: !!student,
                teacherFound: !!effectiveTeacher
              });
            }
          });
      } catch (err) {
        console.error('Background PDF preparation failed:', err);
      }
    };
    maybePrepare();
  }, [isOpen, hasLoadedStudents, classData, students]);

  const handleRegeneratePDFs = async () => {
    setIsRegenerating(true);
    const toastId = toast.loading('Regenerating PDFs...', {
      description: 'This may take a moment'
    });
    
    try {
      const reports = await getReportsForClass(classData.id);
      const students = await getStudentsForClass(classData.id);
      const teacher = await getTeacherByEmail(classData.teacherEmail);
      
      if (!teacher) {
        toast.error('Teacher not found', {
          id: toastId,
          description: 'Cannot regenerate PDFs without teacher information'
        });
        setIsRegenerating(false);
        return;
      }
      
      let regenerated = 0;
      let skipped = 0;
      
      await Promise.all(
        reports.map(async (report) => {
          if (!isReportReadyForPDF(report)) {
            skipped++;
            return;
          }
          
          const student = students.find(s => s.id === report.studentId);
          if (!student) {
            skipped++;
            return;
          }
          
          // Clear pdfUrl to force regeneration
          try {
            await updateReport(report.id, { pdfUrl: undefined });
            // Trigger regeneration
            await generatePDFInBackground(report, student, classData, teacher);
            regenerated++;
          } catch (error) {
            console.error(`Failed to regenerate PDF for report ${report.id}:`, error);
            skipped++;
          }
        })
      );
      
      toast.success(`Regenerated ${regenerated} PDF${regenerated === 1 ? '' : 's'}`, {
        id: toastId,
        description: skipped > 0 ? `${skipped} report${skipped === 1 ? '' : 's'} skipped` : 'All PDFs regenerated'
      });
    } catch (error) {
      console.error('Error regenerating PDFs:', error);
      toast.error('Failed to regenerate PDFs', {
        id: toastId,
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadClass = async () => {
    setIsDownloading(true);
    const toastId = toast.loading('Preparing ZIP download...', {
      description: 'Gathering reports'
    });
    
    try {
      const reports = await getReportsForClass(classData.id);
      // Get student and teacher data for reports
      const students = await getStudentsForClass(classData.id);
      const teacher = await getTeacherByEmail(classData.teacherEmail);

      // Show counts: verified prepared PDFs and ready (image+text)
      const checkPdfExists = async (pdfUrl?: string) => {
        if (!pdfUrl) return false;
        try {
          // refreshDownloadURL is now statically imported
          const url = await refreshDownloadURL(pdfUrl);
          if (!url) return false;
          const res = await fetch(url, { method: 'HEAD' });
          return res.ok;
        } catch { return false; }
      };
      const existence = await Promise.all(reports.map(r => checkPdfExists(r.pdfUrl)));
      const totalReports = reports.length;
      const preparedCount = existence.filter(Boolean).length;
      const readyCount = reports.filter((r, i) => isReportReadyForPDF(r) && !existence[i]).length;
      if (DEBUG) console.log('[class] download:counts', { totalReports, preparedCount, readyCount });
      toast.info(`${preparedCount}/${totalReports} Reports Prepared`, {
        description: `${readyCount} ready to prepare`
      });

      // Fire-and-forget background generation for ready but unprepared reports
      reports
        .filter(r => isReportReadyForPDF(r) && !r.pdfUrl)
        .forEach((r) => {
          const student = students.find(s => s.id === r.studentId);
          if (student && teacher) {
            generatePDFInBackground(r, student, classData, teacher);
          }
        });
      
      // Convert to ClassReport format for existing ZIP function
      const classReports: ClassReport[] = reports.map(report => {
        const student = students.find(s => s.id === report.studentId);
        return {
          studentName: student ? formatStudentName(student.firstName, student.lastName) : 'Unknown Student',
          classLevel: classData.classLevel,
          classLocation: classData.classLocation,
          comments: report.reportText,
          teacher: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher',
          date: (() => {
            // Handle Firestore timestamps properly with validation
            const timestamp = report.createdAt;
            let dateObj: Date | null = null;
            
            try {
              if (timestamp && typeof timestamp === 'object') {
                // Firestore timestamp with seconds property
                if ('seconds' in timestamp) {
                  dateObj = new Date((timestamp as { seconds: number }).seconds * 1000);
                  if (DEBUG) console.log('[class] date:from-seconds', { 
                    student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                    seconds: (timestamp as { seconds: number }).seconds,
                    dateObj: dateObj?.toISOString()
                  });
                }
                // Firestore Timestamp object with toDate method
                else if ('toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function') {
                  dateObj = (timestamp as { toDate: () => Date }).toDate();
                  if (DEBUG) console.log('[class] date:from-toDate', { 
                    student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                    dateObj: dateObj?.toISOString()
                  });
                }
              }
              // If it's already a Date object
              else if (timestamp && typeof timestamp === 'object' && 'getTime' in timestamp && typeof (timestamp as any).getTime === 'function') {
                dateObj = timestamp as Date;
                if (DEBUG) console.log('[class] date:from-date-obj', { 
                  student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                  dateObj: dateObj?.toISOString()
                });
              }
              // Fallback: try to convert
              else if (timestamp) {
                dateObj = new Date(timestamp as string | number);
                if (DEBUG) console.log('[class] date:from-conversion', { 
                  student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                  timestamp,
                  dateObj: dateObj?.toISOString()
                });
              }
              
              // Validate the date and format it
              if (dateObj && !isNaN(dateObj.getTime())) {
                const formatted = dateObj.toLocaleDateString('en-GB');
                // Double-check the formatted string isn't "Invalid Date"
                if (formatted && formatted !== 'Invalid Date' && formatted !== 'NaN/NaN/NaN') {
                  if (DEBUG) console.log('[class] date:formatted-success', { 
                    student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                    formatted
                  });
                  return formatted;
                } else {
                  if (DEBUG) console.warn('[class] date:formatted-invalid', { 
                    student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                    formatted,
                    dateObj: dateObj?.toISOString()
                  });
                }
              } else {
                if (DEBUG) console.warn('[class] date:invalid-date-obj', { 
                  student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                  dateObj,
                  isNaN: dateObj ? isNaN(dateObj.getTime()) : 'null'
                });
              }
            } catch (error) {
              DEBUG && console.warn('[class] date-format-error', { 
                student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
                timestamp, 
                error 
              });
            }
            
            // Fallback to current date if all else fails
            const fallback = new Date().toLocaleDateString('en-GB');
            if (DEBUG) console.warn('[class] date:using-fallback', { 
              student: student ? `${student.firstName} ${student.lastName}` : 'unknown',
              fallback,
              originalTimestamp: timestamp
            });
            return fallback;
          })(),
          artwork: report.artworkUrl || '',
          pdfUrl: report.pdfUrl
        };
      });
      
      const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher';
      
      // Update toast to show downloading
      toast.loading('Downloading reports...', {
        id: toastId,
        description: 'Generating PDFs and creating ZIP file'
      });

      const result: ZIPGenerationResult = await generateClassZIP(classReports, classData.classLevel, teacherName);

      // Update toast to show success with skipped count if any
      const description = result.skippedCount > 0 
        ? `${result.skippedCount} incomplete report${result.skippedCount === 1 ? '' : 's'} skipped`
        : 'ZIP file ready';
      
      toast.success(`Downloaded ${result.successCount} completed report${result.successCount === 1 ? '' : 's'}`, {
        id: toastId,
        description
      });
    } catch (error) {
      console.error('Error downloading class ZIP:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download ZIP';
      toast.error('Failed to download ZIP', {
        id: toastId,
        description: errorMessage
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      loadStudents();
    }
    setIsOpen(!isOpen);
  };

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleToggle}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} class details for ${classData.classLevel}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle();
              }
            }}
          >
            <div className="flex items-center justify-between">
              <CardTitle>
                {classData.classDay} - {classData.classLocation}
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-6 ml-7">
              <StatisticItem
                icon={Users}
                value={studentCount === null ? '...' : studentCount}
                label="Students"
                loading={studentCount === null}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2">Loading students...</span>
              </div>
            ) : students.length === 0 ? (
              <>
                <div className="text-center py-8 text-muted-foreground">
                  No students assigned to this class yet.
                </div>
                
                {/* Show +/- Students button even when no students */}
                <CardFooter className="pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStudentModal(true);
                    }}
                    aria-label={`Manage students for ${classData.classLevel} class`}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    +/- Students
                  </Button>
                </CardFooter>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  {students.map((student) => (
                    <StudentCard
                      key={student.id}
                      student={student}
                      classData={classData}
                      isSelected={selectedStudentId === student.id}
                      onStudentSelected={onStudentSelected}
                    />
                  ))}
                </div>
                
                {/* Action Buttons */}
                <CardFooter className="pt-4 flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStudentModal(true);
                    }}
                    aria-label={`Manage students for ${classData.classLevel} class`}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    +/- Students
                  </Button>
                  {students.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegeneratePDFs();
                        }}
                        disabled={isRegenerating}
                        aria-label={`Regenerate PDFs for ${classData.classLevel} class`}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                        {isRegenerating ? 'Regenerating...' : 'Regenerate PDFs'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadClass}
                        disabled={isDownloading}
                        aria-label={`Download ZIP file for ${classData.classLevel} class`}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isDownloading ? 'Downloading...' : 'Download ZIP'}
                      </Button>
                    </>
                  )}
                </CardFooter>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Class Student Management Modal */}
      <ClassStudentManagementModal
        classData={classData}
        teacherEmail={classData.teacherEmail}
        isOpen={showStudentModal}
        onClose={() => setShowStudentModal(false)}
      />
    </Card>
  );
});
