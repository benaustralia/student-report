import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatisticItem } from '@/components/ui/statistic-item';
import { ChevronDown, ChevronRight, User, BookOpen, Users } from 'lucide-react';
import type { Class } from '@/types';
import { ClassCard } from './ClassCard';
import { getStudentCountsForClasses } from '@/services/firebaseService-ultra-final';

interface TeacherCardProps {
  teacherName: string;
  teacherEmail: string;
  classes: Class[];
  selectedStudentId?: string | null;
  onStudentSelected?: (studentId: string) => void;
  openClassCardId?: string | null;
  onClassCardToggle?: (classId: string, isOpen: boolean) => void;
}

export const TeacherCard: React.FC<TeacherCardProps> = React.memo(({ 
  teacherName, 
  teacherEmail, 
  classes,
  selectedStudentId,
  onStudentSelected,
  openClassCardId,
  onClassCardToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);

  const loadStudentCounts = React.useCallback(async () => {
    try {
      const studentCounts = await getStudentCountsForClasses(classes.map(c => c.id));
      setTotalStudents(Object.values(studentCounts).reduce((sum, count) => sum + count, 0));
    } catch (error) {
      console.error('Error loading student counts:', error);
      setTotalStudents(0);
    }
  }, [classes]);

  useEffect(() => { if (classes.length > 0) loadStudentCounts(); }, [loadStudentCounts]);

  useEffect(() => {
    const handleDataChange = (event: CustomEvent) => {
      if (event.detail?.type === 'students') loadStudentCounts();
    };
    window.addEventListener('dataChanged', handleDataChange as unknown as EventListener);
    return () => window.removeEventListener('dataChanged', handleDataChange as unknown as EventListener);
  }, [loadStudentCounts]);

  useEffect(() => {
    const handleExpandTeacher = (e: CustomEvent) => { if (e.detail.teacherEmail === teacherEmail) setIsOpen(true); };
    window.addEventListener('expandTeacherForStudent', handleExpandTeacher as unknown as EventListener);
    return () => window.removeEventListener('expandTeacherForStudent', handleExpandTeacher as unknown as EventListener);
  }, [teacherEmail]);

  useEffect(() => {
    const handleExpandClass = (e: CustomEvent) => { if (classes.some(c => c.id === e.detail.classId)) setIsOpen(true); };
    window.addEventListener('expandClassForStudent', handleExpandClass as EventListener);
    return () => window.removeEventListener('expandClassForStudent', handleExpandClass as EventListener);
  }, [classes]);

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} teacher details for ${teacherName}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(!isOpen);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <CardTitle>
                  {teacherName}
                </CardTitle>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-6 ml-7">
              <StatisticItem
                icon={BookOpen}
                value={classes.length}
                label="Classes"
              />
              <StatisticItem
                icon={Users}
                value={totalStudents === null ? '...' : totalStudents}
                label="Students"
                loading={totalStudents === null}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {classes.map((classData) => (
                <ClassCard
                  key={classData.id}
                  classData={classData}
                  selectedStudentId={selectedStudentId}
                  onStudentSelected={onStudentSelected}
                  isOpen={openClassCardId === classData.id}
                  onToggle={(isOpen) => onClassCardToggle?.(classData.id, isOpen)}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});