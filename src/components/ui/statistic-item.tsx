import React from 'react';
import { TypographyLarge, TypographySmall } from '@/components/ui/typography';
import type { LucideIcon } from 'lucide-react';

interface StatisticItemProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  loading?: boolean;
  iconColor?: string;
  className?: string;
}

export const StatisticItem: React.FC<StatisticItemProps> = ({
  icon: Icon,
  value,
  label,
  loading = false,
  iconColor = 'text-muted-foreground',
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <TypographyLarge>
        {loading ? '...' : value}
      </TypographyLarge>
      <TypographySmall className="text-muted-foreground">
        {label}
      </TypographySmall>
    </div>
  );
};
