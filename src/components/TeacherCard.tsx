import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypographyMuted } from '@/components/ui/typography';
import { StatisticItem } from '@/components/ui/statistic-item';
import { ChevronDown, ChevronRight, User, BookOpen, Users } from 'lucide-react';
import type { Class } from '@/types';
import { ClassCard } from './ClassCard';
import { getStudentCountsForClasses } from '@/services/firebaseService';

interface TeacherCardProps {
  teacherName: string;
  teacherEmail: string;
  classes: Class[];
  isAdmin?: boolean;
}

export const TeacherCard: React.FC<TeacherCardProps> = React.memo(({ 
  teacherName, 
  teacherEmail, 
  classes, 
  isAdmin = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);

  // Load student counts for all classes to calculate total - optimized with single query
  useEffect(() => {
    const loadStudentCounts = async () => {
      try {
        const classIds = classes.map(classData => classData.id);
        const studentCounts = await getStudentCountsForClasses(classIds);
        const total = Object.values(studentCounts).reduce((sum, count) => sum + count, 0);
        setTotalStudents(total);
      } catch (error) {
        console.error('Error loading student counts:', error);
        setTotalStudents(0);
      }
    };

    if (classes.length > 0) {
      loadStudentCounts();
    }
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
            <TypographyMuted className="ml-7">
              {teacherEmail}
            </TypographyMuted>
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
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});