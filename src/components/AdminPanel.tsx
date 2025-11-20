import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Users, ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import { DataBuilder } from './DataBuilder';
import { StatisticsBar } from './StatisticsBar';
import { getAllUsers, getAllClasses, getAllStudents, getAllTeachers, isUserAdmin, getTeacherReportCounts, getIncompleteReports, getUserDisplayName, getAllReports } from '@/services/firebaseService-ultra-final';
import type { User } from 'firebase/auth';
import type { Class, Student, AdminUser, Teacher, ReportData } from '@/types';

interface AdminPanelProps { 
  user: User; 
  onNavigateToStudent?: (studentId: string) => void;
  onTabChange?: (activeTab: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onTabChange }) => {
  const [state, setState] = useState({ 
    isAdmin: false, 
    loading: true, 
    showDataBuilder: false, 
    error: null as string | null, 
    data: { 
      users: [] as AdminUser[], 
      classes: [] as Class[], 
      students: [] as Student[], 
      teachers: [] as Teacher[], 
      teacherCount: 0, 
      adminCount: 0,
      reports: [] as ReportData[]
    }, 
    openSections: { 
      users: false, 
      classes: true, 
      students: true, 
      incompleteReports: false 
    }, 
    teacherReportStats: {} as Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>, 
    incompleteReports: [] as ReportData[], 
    teacherDisplayNames: {} as Record<string, string>,
    openClassId: null as string | null
  });

  // Handle accordion state changes with auto-close functionality for Users and Classes
  const handleBrowseAccordionChange = (section: 'users' | 'classes', isOpen: boolean) => {
    setState(prev => {
      // If opening a section, close the other one
      if (isOpen) {
        return {
          ...prev,
          openSections: {
            ...prev.openSections,
            users: section === 'users' ? true : false,
            classes: section === 'classes' ? true : false
          }
        };
      }
      // If closing a section, just update that section
      return {
        ...prev,
        openSections: {
          ...prev.openSections,
          [section]: false
        }
      };
    });
  };

  const loadData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const [adminUsers, teachers, classes, students, teacherReportStats, incompleteReports, allReports] = await Promise.all([
        getAllUsers().catch(() => []), 
        getAllTeachers().catch(() => []), 
        getAllClasses().catch(() => []), 
        getAllStudents().catch(() => []),
        getTeacherReportCounts().catch(() => ({})),
        getIncompleteReports().catch(() => []),
        getAllReports().catch(() => [])
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
        data: { 
          users: allUsers, 
          classes, 
          students, 
          teachers: uniqueTeachers, 
          teacherCount: uniqueTeachers.length, 
          adminCount: allUsers.filter(u => u.isAdmin).length,
          reports: allReports
        }, 
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
      <StatisticsBar />
      <Tabs defaultValue="browse" className="w-full" onValueChange={onTabChange}>
            <TabsList className="w-full">
              <TabsTrigger value="browse" className="flex-1">Browse</TabsTrigger>
              <TabsTrigger value="build" className="flex-1">Build</TabsTrigger>
            </TabsList>
            <TabsContent value="browse" className="space-y-4">
              
              {(state.data.adminCount > 0 || state.data.teacherCount > 0) && (
                <Card><Collapsible open={state.openSections.users} onOpenChange={(isOpen) => handleBrowseAccordionChange('users', isOpen)}>
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
              {state.data.users.map((u, i) => {
                // Check if user is also a teacher (exists in teachers list)
                const isTeacher = state.data.teachers.some(t => t.email === u.email);
                // Exceptions: Ben Hinton and Jackson Tester should only show Admin badge
                const email = u.email?.toLowerCase() || '';
                const isException = email === 'bahinton@gmail.com' || email === 'jackson@tester.com';
                
                return <div key={u.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{u.firstName} {u.lastName}</span>
                    {u.isAdmin && (
                      <Badge variant="default" className="text-xs flex-shrink-0">Admin</Badge>
                    )}
                    {isTeacher && !isException && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">Teacher</Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                </div>
              })}
            </CardContent></CollapsibleContent>
          </Collapsible></Card>)}
        
        {state.data.classes.length > 0 && (
          <Card><Collapsible open={state.openSections.classes} onOpenChange={(isOpen) => handleBrowseAccordionChange('classes', isOpen)}>
            <CollapsibleTrigger asChild><CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 flex-shrink-0" />
                  <span>Classes & Reports</span>
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
              }, {} as Record<string, { teacherName: string; teacherEmail: string; classes: Class[] }>)).map((teacherData) => {
                // Calculate teacher report counts - get all students for this teacher's classes
                const teacherClassIds = teacherData.classes.map(c => c.id);
                const teacherStudents = state.data.students.filter(s => {
                  const studentClassId = typeof s.classId === 'string' ? s.classId : String(s.classId);
                  return teacherClassIds.some(cid => {
                    const classId = typeof cid === 'string' ? cid : String(cid);
                    return studentClassId === classId;
                  });
                });
                const teacherStudentIds = teacherStudents.map(s => s.id);
                const teacherReports = state.data.reports.filter(r => teacherStudentIds.includes(r.studentId));
                const teacherComplete = teacherReports.filter(r => r.reportText?.trim() && r.artworkUrl?.trim()).length;
                const teacherTotal = teacherStudents.length; // Total students, not total reports

                return (
                  <Card key={teacherData.teacherEmail} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{teacherData.teacherName}</span>
                        <Badge variant="default" className="text-xs">
                          {teacherComplete}/{teacherTotal}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {teacherData.classes.map((classData) => {
                          // Calculate class report counts
                          // Get all students in this class
                          const classStudents = state.data.students.filter(s => {
                            const studentClassId = typeof s.classId === 'string' ? s.classId : String(s.classId);
                            const classId = typeof classData.id === 'string' ? classData.id : String(classData.id);
                            return studentClassId === classId;
                          });
                          const classStudentIds = classStudents.map(s => s.id);
                          const classTotal = classStudents.length; // Total students in class
                          
                          // Get all reports for students in this class
                          const classReports = state.data.reports.filter(r => classStudentIds.includes(r.studentId));
                          
                          // Count complete reports (text + image)
                          const classComplete = classReports.filter(r => {
                            const hasText = r.reportText && r.reportText.trim().length > 0;
                            const hasImage = r.artworkUrl && r.artworkUrl.trim().length > 0;
                            return hasText && hasImage;
                          }).length;
                          
                          const isOpen = state.openClassId === classData.id;

                          // Calculate breakdown
                          const textAndImage = classReports.filter(r => r.reportText?.trim() && r.artworkUrl?.trim()).length;
                          const textOnly = classReports.filter(r => r.reportText?.trim() && !r.artworkUrl?.trim()).length;
                          const imageOnly = classReports.filter(r => !r.reportText?.trim() && r.artworkUrl?.trim()).length;

                          return (
                            <div key={classData.id} className="border rounded">
                              <Collapsible open={isOpen} onOpenChange={(open) => {
                                setState(prev => ({ ...prev, openClassId: open ? classData.id : null }));
                              }}>
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between gap-2 p-2 cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{classData.classDay} at {classData.classTime}</span>
                                      <Badge variant="secondary" className="text-xs">{classData.classLevel}</Badge>
                                      <Badge variant="default" className="text-xs">
                                        {classComplete}/{classTotal}
                                      </Badge>
                                    </div>
                                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="px-2 pb-2 space-y-1 text-sm">
                                    <div className="text-muted-foreground">Text + picture: {textAndImage}</div>
                                    <div className="text-muted-foreground">Text only: {textOnly}</div>
                                    <div className="text-muted-foreground">Image only: {imageOnly}</div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                );
              })}
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
