import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypographyMuted } from '@/components/ui/typography';
import { StatisticItem } from '@/components/ui/statistic-item';
import { ChevronDown, ChevronRight, Users, Download } from 'lucide-react';
import { getStudentsForClass, getReportsForClass, getTeacherByEmail, getStudentCountsForClasses } from '@/services/firebaseService';
import type { Class, Student } from '@/types';
import { StudentCard } from './StudentCard';
import { generateClassZIP, type ClassReport } from '@/services/zipService';

interface ClassCardProps {
  classData: Class;
  isAdmin?: boolean;
}

export const ClassCard: React.FC<ClassCardProps> = React.memo(({ classData, isAdmin = false }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [studentCount, setStudentCount] = useState<number | null>(null);

  const loadStudents = async () => {
    if (students.length > 0) return; // Already loaded
    
    setLoading(true);
    try {
      const studentsData = await getStudentsForClass(classData.id);
      setStudents(studentsData);
      setStudentCount(studentsData.length);
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

  // Listen for data changes from DataBuilder to refresh student count
  React.useEffect(() => {
    const handleDataChange = (event: CustomEvent) => {
      // Only refresh when students are added/updated/deleted
      if (event.detail?.type === 'students') {
        loadStudentCount();
      }
    };

    window.addEventListener('dataChanged', handleDataChange as unknown as EventListener);
    return () => window.removeEventListener('dataChanged', handleDataChange as unknown as EventListener);
  }, [loadStudentCount]);

  const handleDownloadClass = async () => {
    setIsDownloading(true);
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
          date: report.createdAt.toLocaleDateString()
        };
      });
      
      const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher';
      await generateClassZIP(classReports, classData.classLevel, teacherName);
    } catch (error) {
      console.error('Error downloading class ZIP:', error);
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
            <TypographyMuted className="ml-7">
              {classData.teacherEmail}
            </TypographyMuted>
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
              <div className="text-center py-8 text-muted-foreground">
                No students assigned to this class yet.
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {students.map((student) => (
                    <StudentCard
                      key={student.id}
                      student={student}
                      classData={classData}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
                
                {/* Download ZIP Button */}
                {students.length > 0 && (
                  <CardFooter className="pt-4">
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
                  </CardFooter>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});
