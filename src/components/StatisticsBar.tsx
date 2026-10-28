import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatisticItem } from '@/components/ui/statistic-item';
import { Users, BookOpen, FileText } from 'lucide-react';
import { getStats } from '@/services/api';

interface StatisticsBarProps { className?: string }

/** Headline counts. Refreshes on mount and whenever the DataBuilder announces a change. */
export const StatisticsBar: React.FC<StatisticsBarProps> = ({ className = '' }) => {
  const [stats, setStats] = useState({ userCount: 0, classCount: 0, studentCount: 0, loading: true });

  useEffect(() => {
    let mounted = true;
    const load = () => getStats()
      .then(s => { if (mounted) setStats({ ...s, loading: false }); })
      .catch(() => { if (mounted) setStats(prev => ({ ...prev, loading: false })); });
    load();
    const onChange = () => { load(); };
    window.addEventListener('dataChanged', onChange);
    return () => { mounted = false; window.removeEventListener('dataChanged', onChange); };
  }, []);

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
          <StatisticItem icon={Users} value={stats.userCount} label="Users" loading={stats.loading} iconColor="text-primary" />
          <StatisticItem icon={BookOpen} value={stats.classCount} label="Classes" loading={stats.loading} iconColor="text-green-600" />
          <StatisticItem icon={FileText} value={stats.studentCount} label="Students" loading={stats.loading} iconColor="text-purple-600" />
        </div>
      </CardContent>
    </Card>
  );
};
