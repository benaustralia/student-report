import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypographyMuted } from '@/components/ui/typography';
import { ChevronDown, ChevronRight, User, BookOpen, Users } from 'lucide-react';
import type { Class } from '@/types';
import { ClassCard } from './ClassCard';
import { getStudentsForClass } from '@/services/firebaseService';

interface TeacherCardProps {
  teacherName: string;
  teacherEmail: string;
  classes: Class[];
  user: any; // User from Firebase Auth
  isAdmin?: boolean;
}

export const TeacherCard: React.FC<TeacherCardProps> = ({ 
  teacherName, 
  teacherEmail, 
  classes, 
  user, 
  isAdmin = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);

  // Load student counts for all classes to calculate total
  useEffect(() => {
    const loadStudentCounts = async () => {
      try {
        const studentCountPromises = classes.map(classData => 
          getStudentsForClass(classData.id).then(students => students.length)
        );
        const studentCounts = await Promise.all(studentCountPromises);
        const total = studentCounts.reduce((sum, count) => sum + count, 0);
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
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <User className="h-5 w-5" />
                <CardTitle className="text-lg">
                  {teacherName}
                </CardTitle>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{classes.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>
                    {totalStudents === null ? '...' : totalStudents}
                  </span>
                </div>
              </div>
            </div>
            <TypographyMuted className="ml-6">
              {teacherEmail}
            </TypographyMuted>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {classes.map((classData) => (
                <ClassCard
                  key={classData.id}
                  classData={classData}
                  user={user}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};