import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypographyMuted } from '@/components/ui/typography';
import { ChevronDown, ChevronRight, Users, Download } from 'lucide-react';
import { getStudentsForClass, getReportsForClass } from '@/services/firebaseService';
import type { Class, Student } from '@/types';
import { StudentCard } from './StudentCard';
import { generateClassZIP, type ClassReport } from '@/services/zipService';

interface ClassCardProps {
  classData: Class;
  user: any; // User from Firebase Auth
  isAdmin?: boolean;
}

export const ClassCard: React.FC<ClassCardProps> = ({ classData, user, isAdmin = false }) => {
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

  // Load student count on mount to show accurate count
  React.useEffect(() => {
    loadStudents();
  }, [classData.id]);

  const handleDownloadClass = async () => {
    setIsDownloading(true);
    try {
      const reports = await getReportsForClass(classData.id);
      
      // Convert to ClassReport format for existing ZIP function
      const classReports: ClassReport[] = reports.map(report => ({
        studentName: `${report.studentFirstName} ${report.studentLastName}`,
        classLevel: report.classLevel,
        classLocation: report.classLocation,
        comments: report.reportText,
        teacher: `${report.teacherFirstName} ${report.teacherLastName}`,
        date: report.createdAt.toLocaleDateString()
      }));
      
      await generateClassZIP(classReports, classData.classLevel, classData.teacherLastName);
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
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-lg">
                  {classData.classDay}, {classData.classTime} - {classData.classLocation}
                </CardTitle>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {studentCount === null ? '...' : studentCount}
                </span>
              </div>
            </div>
            <TypographyMuted className="ml-6">
              {classData.teacherFirstName} {classData.teacherLastName}
            </TypographyMuted>
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
                      user={user}
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
};
