import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatisticItem } from '@/components/ui/statistic-item';
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
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
          <StatisticItem
            icon={Users}
            value={adminCount}
            label="Admin"
            loading={loading}
            iconColor="text-primary"
          />
          <StatisticItem
            icon={GraduationCap}
            value={teacherCount}
            label="Teachers"
            loading={loading}
            iconColor="text-orange-600"
          />
          <StatisticItem
            icon={BookOpen}
            value={classCount}
            label="Classes"
            loading={loading}
            iconColor="text-green-600"
          />
          <StatisticItem
            icon={FileText}
            value={studentCount}
            label="Students"
            loading={loading}
            iconColor="text-purple-600"
          />
        </div>
      </CardContent>
    </Card>
  );
};
