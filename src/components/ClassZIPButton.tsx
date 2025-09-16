import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Archive } from 'lucide-react';
import { generateClassZIP, type ClassReport } from '../services/zipService';

interface ClassData {
  class: string;
  reports: any[];
}

interface ClassZIPButtonProps {
  classData: ClassData;
  teacherName: string;
}

export const ClassZIPButton: React.FC<ClassZIPButtonProps> = ({ 
  classData, 
  teacherName 
}) => {
  const [isGeneratingZIP, setIsGeneratingZIP] = useState<boolean>(false);

  const handleDownloadZIP = async () => {
    try {
      setIsGeneratingZIP(true);
      
      // Convert reports to ClassReport format
      const classReports: ClassReport[] = classData.reports.map(report => {
        const classParts = report.class.split(' - ');
        const classLevel = classParts[0] || report.grade;
        const classLocation = classParts[1] || '';
        
        return {
          studentName: report.student,
          classLevel: classLevel,
          classLocation: classLocation,
          comments: report.comments,
          teacher: report.teacher,
          date: new Date().toLocaleDateString()
        };
      });

      await generateClassZIP(classReports, classData.class, teacherName);
    } catch (error) {
      console.error('Error generating ZIP:', error);
      alert('Failed to generate ZIP file. Please try again.');
    } finally {
      setIsGeneratingZIP(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={(e) => { 
        e.stopPropagation(); 
        handleDownloadZIP(); 
      }}
      disabled={isGeneratingZIP}
    >
      <Archive className="w-4 h-4 mr-2" />
      {isGeneratingZIP ? 'Generating...' : 'ZIP'}
    </Button>
  );
};

export default ClassZIPButton;
