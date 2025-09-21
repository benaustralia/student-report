import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, BookOpen, GraduationCap, FileText } from 'lucide-react';

interface StatisticsBarProps {
  adminCount: number;
  teacherCount: number;
  classCount: number;
  studentCount: number;
  loading?: boolean;
  className?: string;
}

export const StatisticsBar: React.FC<StatisticsBarProps> = ({
  adminCount,
  teacherCount,
  classCount,
  studentCount,
  loading = false,
  className = ''
}) => {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold">
                {loading ? '...' : adminCount}
              </div>
              <div className="text-sm text-muted-foreground">Admin</div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <GraduationCap className="h-8 w-8 text-orange-600" />
            <div>
              <div className="text-2xl font-bold">
                {loading ? '...' : teacherCount}
              </div>
              <div className="text-sm text-muted-foreground">Teachers</div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold">
                {loading ? '...' : classCount}
              </div>
              <div className="text-sm text-muted-foreground">Classes</div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold">
                {loading ? '...' : studentCount}
              </div>
              <div className="text-sm text-muted-foreground">Students</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
