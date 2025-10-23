import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Users, ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import { DataBuilder } from './DataBuilder';
import { StatisticsBar } from './StatisticsBar';
import { getAllUsers, getAllClasses, getAllStudents, getAllTeachers, isUserAdmin, getTeacherReportCounts, getIncompleteReports, getUserDisplayName } from '@/services/firebaseService-ultra-final';
import type { User } from 'firebase/auth';
import type { Class, Student, AdminUser, Teacher, ReportData } from '@/types';

interface AdminPanelProps { 
  user: User; 
  onNavigateToStudent?: (studentId: string) => void;
  onTabChange?: (activeTab: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onTabChange }) => {
  const [state, setState] = useState({ isAdmin: false, loading: true, showDataBuilder: false, error: null as string | null, data: { users: [] as AdminUser[], classes: [] as Class[], students: [] as Student[], teachers: [] as Teacher[], teacherCount: 0, adminCount: 0 }, openSections: { users: false, classes: true, students: true, incompleteReports: false }, teacherReportStats: {} as Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>, incompleteReports: [] as ReportData[], teacherDisplayNames: {} as Record<string, string> });

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
      
      // Load teacher display names
      const teacherDisplayNames: Record<string, string> = {};
      const uniqueTeacherEmails = [...new Set(classes.map(c => c.teacherEmail))];
      await Promise.all(uniqueTeacherEmails.map(async (email) => {
        try {
          const displayName = await getUserDisplayName(email);
          teacherDisplayNames[email] = displayName || 'Unknown Teacher';
        } catch (error) {
          console.error(`Failed to get display name for ${email}:`, error);
          teacherDisplayNames[email] = 'Unknown Teacher';
        }
      }));
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
        teacherDisplayNames,
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

  // Listen for data changes from DataBuilder
  useEffect(() => {
    const handleDataChanged = (event: CustomEvent) => {
      const { type } = event.detail;
      
      // Only reload data for changes that affect the admin panel view
      // Skip individual student deletions and class updates to prevent unnecessary refreshes
      if (type === 'users' || type === 'teachers' || type === 'reports') {
        loadData();
      } else if (type === 'classes') {
        // For classes, only reload if it's not an update (to avoid refreshing the whole app)
        const { action } = event.detail;
        if (action !== 'update') {
          loadData();
        } else {
          // Skip refresh for class updates
        }
      } else if (type === 'students') {
        // For students, reload for all actions except bulk import to keep stats updated
        const { action } = event.detail;
        if (action !== 'bulk_import') {
          loadData();
        } else {
          // Skip refresh for bulk imports
        }
      } else if (type === 'requests') {
        // Skip refresh for requests - StatisticsBar handles real-time updates
      }
    };

    window.addEventListener('dataChanged', handleDataChanged as EventListener);
    return () => {
      window.removeEventListener('dataChanged', handleDataChanged as EventListener);
    };
  }, []);

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

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      <Tabs defaultValue="browse" className="w-full" onValueChange={onTabChange}>
            <TabsList className="w-full">
              <TabsTrigger value="browse" className="flex-1">Browse</TabsTrigger>
              <TabsTrigger value="build" className="flex-1">Build</TabsTrigger>
            </TabsList>
            <TabsContent value="browse" className="space-y-4">
              <StatisticsBar />
              
              {(state.data.adminCount > 0 || state.data.teacherCount > 0) && (
                <Card><Collapsible open={state.openSections.users} onOpenChange={() => setState(prev => ({ ...prev, openSections: { ...prev.openSections, users: !prev.openSections.users } }))}>
            <CollapsibleTrigger asChild><CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 flex-shrink-0" />
                  <span>Users</span>
                  <Badge variant="secondary" className="text-xs">{state.data.adminCount + state.data.teacherCount}</Badge>
                </CardTitle>
                {state.openSections.users ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
              </div>
            </CardHeader></CollapsibleTrigger>
            <CollapsibleContent><CardContent className="space-y-2">
              {state.data.users.filter(u => u.isAdmin).map((u, i) => {
                return <div key={u.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{u.firstName} {u.lastName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                </div>
              })}
              {state.data.users.filter(u => !u.isAdmin).map((u, i) => {
                return <div key={u.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{u.firstName} {u.lastName}</span>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">Teacher</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                </div>
              })}
            </CardContent></CollapsibleContent>
          </Collapsible></Card>)}
        
        {state.data.classes.length > 0 && (
          <Card><Collapsible open={state.openSections.classes} onOpenChange={() => setState(prev => ({ ...prev, openSections: { ...prev.openSections, classes: !prev.openSections.classes } }))}>
            <CollapsibleTrigger asChild><CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 flex-shrink-0" />
                  <span>Classes</span>
                  <Badge variant="secondary" className="text-xs">{state.data.classes.length}</Badge>
                </CardTitle>
                {state.openSections.classes ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
              </div>
            </CardHeader></CollapsibleTrigger>
            <CollapsibleContent><CardContent className="space-y-4">
              {Object.values(state.data.classes.reduce((acc, classData) => {
                const teacherKey = `${classData.teacherEmail}`;
                if (!acc[teacherKey]) acc[teacherKey] = { 
                  teacherName: state.teacherDisplayNames[classData.teacherEmail] || 'Unknown Teacher', 
                  teacherEmail: classData.teacherEmail, 
                  classes: [] 
                };
                acc[teacherKey].classes.push(classData);
                return acc;
              }, {} as Record<string, { teacherName: string; teacherEmail: string; classes: Class[] }>)).map((teacherData) => (
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
            </CardContent></CollapsibleContent>
          </Collapsible></Card>)}
            </TabsContent>
            <TabsContent value="build" className="space-y-4">
              <DataBuilder />
            </TabsContent>
          </Tabs>
    </div>
  );
};
