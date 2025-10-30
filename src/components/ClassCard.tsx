import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatisticItem } from '@/components/ui/statistic-item';
import { ChevronDown, ChevronRight, Users, Download, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { getStudentsForClass, getReportsForClass, getTeacherByEmail, getStudentCountsForClasses } from '@/services/firebaseService-ultra-final';
import type { Class, Student } from '@/types';
import { StudentCard } from './StudentCard';
import { ClassStudentManagementModal } from './ClassStudentManagementModal';
import { generateClassZIP, type ClassReport, type ZIPGenerationResult } from '@/services/zipService';

interface ClassCardProps {
  classData: Class;
  selectedStudentId?: string | null;
  onStudentSelected?: (studentId: string) => void;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export const ClassCard: React.FC<ClassCardProps> = React.memo(({ classData, selectedStudentId, onStudentSelected, isOpen: externalIsOpen, onToggle }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
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
      
      // Convert to ClassReport format for existing ZIP function
      const classReports: ClassReport[] = reports.map(report => {
        const student = students.find(s => s.id === report.studentId);
        return {
          studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown Student',
          classLevel: classData.classLevel,
          classLocation: classData.classLocation,
          comments: report.reportText,
          teacher: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher',
          date: (() => {
            // Handle Firestore timestamps properly
            const timestamp = report.createdAt;
            if (timestamp && typeof timestamp === 'object') {
              // Firestore timestamp with seconds property
              if ('seconds' in timestamp) {
                return new Date((timestamp as { seconds: number }).seconds * 1000).toLocaleDateString('en-GB');
              }
              // Firestore Timestamp object with toDate method
              if ('toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function') {
                return (timestamp as { toDate: () => Date }).toDate().toLocaleDateString('en-GB');
              }
            }
            // If it's already a Date object
            if (timestamp instanceof Date) {
              return timestamp.toLocaleDateString('en-GB');
            }
            // Fallback: try to convert
            return new Date(timestamp as string | number).toLocaleDateString('en-GB');
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
