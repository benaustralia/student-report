import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  icon: LucideIcon;
  badge?: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  subtitle?: string;
  statistics?: React.ReactNode;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  icon: Icon,
  badge,
  isOpen,
  onToggle,
  children,
  className = "",
  subtitle,
  statistics
}) => {
  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon className="h-5 w-5 flex-shrink-0" />
                <CardTitle className="break-words">{title}</CardTitle>
                {badge && (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {badge}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="sr-only">{isOpen ? 'Collapse' : 'Expand'} {title}</span>
              </Button>
            </div>
            {subtitle && (
              <div className="text-sm text-muted-foreground ml-7">
                {subtitle}
              </div>
            )}
            {statistics && (
              <div className="flex items-center gap-6 ml-7">
                {statistics}
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
