import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Database, AlertCircle, Users, Settings, ChevronDown, ChevronRight, FileText, Eye } from 'lucide-react';
import { TypographyH3, TypographySmall } from '@/components/ui/typography';
import { DataBuilder } from './DataBuilder';
import { StatisticsBar } from './StatisticsBar';
import { getAllUsers, getAllClasses, getAllStudents, getAllTeachers, isUserAdmin, getTeacherReportCounts, getIncompleteReports } from '@/services/firebaseService';
import type { User } from 'firebase/auth';
import type { Class, Student, AdminUser, Teacher, ReportData } from '@/types';

interface AdminPanelProps { 
  user: User; 
  onNavigateToStudent?: (studentId: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onNavigateToStudent }) => {
  const [state, setState] = useState({ isAdmin: false, loading: true, showDataBuilder: false, error: null as string | null, data: { users: [] as AdminUser[], classes: [] as Class[], students: [] as Student[], teachers: [] as Teacher[], teacherCount: 0, adminCount: 0 }, openSections: { users: false, classes: true, students: true, incompleteReports: false }, teacherReportStats: {} as Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>, incompleteReports: [] as ReportData[] });

  const loadData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const [adminUsers, teachers, classes, students, teacherReportStats, incompleteReports] = await Promise.all([
        getAllUsers().catch(() => []), 
        getAllTeachers().catch(() => []), 
        getAllClasses().catch(() => []), 
        getAllStudents().catch(() => []),
        getTeacherReportCounts().catch(() => ({})),
        getIncompleteReports().catch(() => [])
      ]);
      const userMap = new Map();
      teachers.forEach(t => t.email && userMap.set(t.email, { ...t, isAdmin: false }));
      adminUsers.forEach(a => a.email && userMap.set(a.email, { ...a, isAdmin: a.isAdmin || false }));
      const allUsers = Array.from(userMap.values());
      const teacherMap = new Map();
      teachers.forEach(t => t.email && teacherMap.set(t.email, t));
      const uniqueTeachers = Array.from(teacherMap.values());
      setState(prev => ({ 
        ...prev, 
        data: { users: allUsers, classes, students, teachers: uniqueTeachers, teacherCount: uniqueTeachers.length, adminCount: allUsers.filter(u => u.isAdmin).length }, 
        teacherReportStats,
        incompleteReports,
        loading: false 
      }));
    } catch { setState(prev => ({ ...prev, loading: false })); }
  };


  useEffect(() => { (async () => { try { const adminStatus = await isUserAdmin(user.email || ''); setState(prev => ({ ...prev, isAdmin: adminStatus, loading: false })); if (adminStatus) await loadData(); } catch { setState(prev => ({ ...prev, error: 'Failed to check admin status', loading: false })); } })(); }, [user]);
  useEffect(() => { 
    if (!state.showDataBuilder && state.isAdmin) {
      loadData();
    }
  }, [state.showDataBuilder, state.isAdmin]);

  if (state.loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin mr-2" /><span>Loading admin panel...</span></div>;
  if (!state.isAdmin) return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Access Denied
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p>You don't have admin privileges to access this panel.</p>
      </CardContent>
    </Card>
  );

  return <div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Admin Panel</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex flex-col sm:flex-row gap-4">
      <Button onClick={() => setState(prev => ({ ...prev, showDataBuilder: !prev.showDataBuilder }))} variant={state.showDataBuilder ? "default" : "outline"}>
        <Settings className="h-4 w-4 mr-2" />
        {state.showDataBuilder ? 'Hide' : 'Show'} Data Builder
      </Button>
    </div>
    {state.showDataBuilder && <DataBuilder />}
    {!state.showDataBuilder && <StatisticsBar adminCount={state.data.adminCount} teacherCount={state.data.teacherCount} classCount={state.data.classes.length} studentCount={state.data.students.length} loading={state.loading} />}
    
    {!state.showDataBuilder && (state.data.adminCount > 0 || state.data.teacherCount > 0) && (
      <Card><Collapsible open={state.openSections.users} onOpenChange={() => setState(prev => ({ ...prev, openSections: { ...prev.openSections, users: !prev.openSections.users } }))}>
        <CollapsibleTrigger asChild><CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
              <div className="flex items-center gap-2"><Users className="h-5 w-5 flex-shrink-0" /><span className="truncate">Admin & Teachers</span></div>
              <Badge variant="secondary" className="text-xs flex-shrink-0">{state.data.adminCount} admins | {state.data.teacherCount} teachers</Badge>
            </CardTitle>
            {state.openSections.users ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
          </div>
        </CardHeader></CollapsibleTrigger>
        <CollapsibleContent><CardContent className="space-y-2">
          {state.data.users.filter(u => u.isAdmin).map((u, i) => {
            const isAlsoTeacher = state.data.teachers.some(t => t.email === u.email);
            const teacherStats = isAlsoTeacher ? state.teacherReportStats[u.email] : null;
            return (
              <Card key={`admin-${i}`} className="p-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1"><Badge variant="default" className="text-xs">Admin</Badge>{isAlsoTeacher && <Badge variant="outline" className="text-xs">Teacher</Badge>}</div>
                    <div className="min-w-0 flex-1">{u.firstName && u.lastName ? (
                      <div className="space-y-1">
                        <div className="font-medium truncate">{u.firstName} {u.lastName}</div>
                        <TypographySmall className="text-muted-foreground truncate">{u.email}</TypographySmall>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-medium text-warning truncate">⚠️ {u.email}</div>
                        <TypographySmall className="text-warning/80">Missing name data</TypographySmall>
                      </div>
                    )}</div>
                  </div>
                  {teacherStats && (
                    <div className="text-center text-sm">
                      <div className={`font-semibold text-lg ${
                        teacherStats.studentCount === 0 
                          ? 'text-muted-foreground' 
                          : teacherStats.reportCount === teacherStats.studentCount 
                            ? 'text-green-600 dark:text-green-400' 
                            : teacherStats.reportCount / teacherStats.studentCount >= 0.75 
                              ? 'text-yellow-600 dark:text-yellow-400' 
                              : 'text-red-600 dark:text-red-400'
                      }`}>
                        {teacherStats.reportCount}/{teacherStats.studentCount}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">Complete</div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
          {state.data.teachers.map((t, i) => {
            const isAlsoAdmin = state.data.users.some(u => u.email === t.email && u.isAdmin);
            if (isAlsoAdmin) return null;
            const classCount = state.data.classes.filter(c => c.teacherEmail === t.email).length;
            const teacherStats = state.teacherReportStats[t.email];
            return (
              <Card key={`teacher-${i}`} className="p-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1"><Badge variant="outline" className="text-xs">Teacher</Badge></div>
                    <div className="min-w-0 flex-1">{t.firstName && t.lastName ? (
                      <div className="space-y-1">
                        <div className="font-medium truncate">{t.firstName} {t.lastName}</div>
                        <TypographySmall className="text-muted-foreground truncate">{t.email}</TypographySmall>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-medium text-warning truncate">⚠️ {t.email}</div>
                        <TypographySmall className="text-warning/80">Missing name data</TypographySmall>
                      </div>
                    )}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {teacherStats && (
                      <div className="text-center text-sm">
                        <div className={`font-semibold text-lg ${
                          teacherStats.studentCount === 0 
                            ? 'text-muted-foreground' 
                            : teacherStats.reportCount === teacherStats.studentCount 
                              ? 'text-green-600 dark:text-green-400' 
                              : teacherStats.reportCount / teacherStats.studentCount >= 0.75 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-red-600 dark:text-red-400'
                        }`}>
                          {teacherStats.reportCount}/{teacherStats.studentCount}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">Complete</div>
                      </div>
                    )}
                    {classCount > 0 && <div className="flex-shrink-0"><Badge variant="secondary" className="text-xs">{classCount} {classCount === 1 ? 'class' : 'classes'}</Badge></div>}
                  </div>
                </div>
              </Card>
            );
          })}
        </CardContent></CollapsibleContent>
      </Collapsible></Card>
    )}

    {!state.showDataBuilder && state.incompleteReports.length > 0 && (
      <Card>
        <Collapsible open={state.openSections.incompleteReports} onOpenChange={() => setState(prev => ({ ...prev, openSections: { ...prev.openSections, incompleteReports: !prev.openSections.incompleteReports } }))}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">Incomplete Reports</span>
                  </div>
                  <Badge variant="destructive" className="text-xs flex-shrink-0">
                    {state.incompleteReports.length} reports
                  </Badge>
                </CardTitle>
                {state.openSections.incompleteReports ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2">
              {state.incompleteReports.map((report, i) => {
                const student = state.data.students.find(s => s.id === report.studentId);
                const classData = state.data.classes.find(c => c.id === report.classId);
                const teacher = state.data.teachers.find(t => t.email === report.teacherEmail);
                
                // Use studentName from report if student not found in state
                const studentName = student 
                  ? `${student.firstName} ${student.lastName}` 
                  : (report.studentName || 'Unknown Student');
                const hasImage = report.artworkUrl && report.artworkUrl.trim() !== '';
                const hasMinText = report.reportText && report.reportText.length >= 150;
                const issues = [];
                if (!hasImage) issues.push('No image');
                if (!hasMinText) issues.push(`Only ${report.reportText?.length || 0} characters`);
                
                return (
                  <Card key={`incomplete-${i}`} className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1">
                          {issues.map((issue, idx) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="space-y-1">
                            <div className="font-medium break-words">
                              {studentName}
                            </div>
                            <TypographySmall className="text-muted-foreground break-words">
                              {classData ? `${classData.classLevel} - ${classData.classLocation}` : 'Unknown Class'} • {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher'}
                            </TypographySmall>
                            {report.reportText && (
                              <TypographySmall className="text-muted-foreground break-words line-clamp-2">
                                "{report.reportText.substring(0, 100)}{report.reportText.length > 100 ? '...' : ''}"
                              </TypographySmall>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-2 sm:mt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (onNavigateToStudent) {
                              onNavigateToStudent(report.studentId);
                            } else {
                              alert(`Navigate to student: ${studentName}`);
                            }
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Report
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )}

    {state.data.users.length === 0 && state.data.classes.length === 0 && state.data.students.length === 0 && (
      <Card>
        <CardContent className="text-center p-8">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <TypographyH3 className="mb-2">No Data Found</TypographyH3>
          <p className="text-muted-foreground">Upload a JSON file to import admin users, classes, and students, or download the sample file to get started.</p>
        </CardContent>
      </Card>
    )}
    {state.error && (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    )}
  </CardContent></Card></div>;
};