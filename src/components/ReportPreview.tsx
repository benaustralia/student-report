import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Loader2 } from 'lucide-react';
import { ReportTemplate } from './ReportTemplate';
import { getTeacherByEmail } from '@/services/firebaseService';
import type { Student, Class, ReportData } from '@/types';

interface ReportPreviewProps {
  student: Student;
  classData: Class;
  reportData?: ReportData;
  reportText: string;
  artworkUrl?: string | null;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  student,
  classData,
  reportData,
  reportText,
  artworkUrl
}) => {
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const studentName = `${student.firstName} ${student.lastName}`;
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Loading...';
  const date = reportData?.createdAt 
    ? new Date(reportData.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  // Fetch teacher information
  useEffect(() => {
    const fetchTeacher = async () => {
      if (classData.teacherEmail) {
        setLoading(true);
        try {
          const teacherData = await getTeacherByEmail(classData.teacherEmail);
          setTeacher(teacherData);
        } catch (error) {
          console.error('Error fetching teacher:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchTeacher();
  }, [classData.teacherEmail]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Preview Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Preview - {studentName}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center p-4">
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
  );
};

export default ReportPreview;
