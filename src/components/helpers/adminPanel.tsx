import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import type { Class, AdminUser } from '@/types';

export function UsersSection({ open, onOpenChange, adminCount, teacherCount, users }: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  adminCount: number;
  teacherCount: number;
  users: (AdminUser & { isAdmin: boolean })[];
}) {
  return (
    <Card>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 flex-shrink-0" />
                <span>Users</span>
                <Badge variant="secondary" className="text-xs">{adminCount + teacherCount}</Badge>
              </CardTitle>
              {open ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2">
            {users.filter(u => u.isAdmin).map((u, i) => (
              <div key={u.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{u.firstName} {u.lastName}</span>
                </div>
                <span className="text-sm text-muted-foreground truncate">{u.email}</span>
              </div>
            ))}
            {users.filter(u => !u.isAdmin).map((u, i) => (
              <div key={u.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{u.firstName} {u.lastName}</span>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">Teacher</Badge>
                </div>
                <span className="text-sm text-muted-foreground truncate">{u.email}</span>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function ClassesSection({ open, onOpenChange, classes, teacherDisplayNames }: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  classes: Class[];
  teacherDisplayNames: Record<string, string>;
}) {
  const grouped = Object.values(classes.reduce((acc, classData) => {
    const teacherKey = `${classData.teacherEmail}`;
    if (!acc[teacherKey]) acc[teacherKey] = { teacherName: teacherDisplayNames[classData.teacherEmail] || 'Unknown Teacher', teacherEmail: classData.teacherEmail, classes: [] as Class[] };
    acc[teacherKey].classes.push(classData);
    return acc;
  }, {} as Record<string, { teacherName: string; teacherEmail: string; classes: Class[] }>));
  return (
    <Card>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 flex-shrink-0" />
                <span>Classes</span>
                <Badge variant="secondary" className="text-xs">{classes.length}</Badge>
              </CardTitle>
              {open ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {grouped.map((teacherData) => (
              <Card key={teacherData.teacherEmail} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{teacherData.teacherName}</span>
                  </div>
                  <div className="space-y-2">
                    {teacherData.classes.map((classData) => (
                      <div key={classData.id} className="flex items-center justify-between gap-2 p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{classData.classDay} at {classData.classTime}</span>
                          <Badge variant="secondary" className="text-xs">{classData.classLevel}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
