import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Users, ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import { DataBuilder } from './DataBuilder';
import { StatisticsBar } from './StatisticsBar';
import { UsersSection, ClassesSection } from '@/components/helpers/adminPanel';
import { isUserAdmin } from '@/services/firebaseService-ultra-final';
import { loadAdminPanelData } from '@/services/adminData';
import type { User } from 'firebase/auth';
import type { Class, Student, AdminUser, Teacher, ReportData } from '@/types';

interface AdminPanelProps { 
  user: User; 
  onNavigateToStudent?: (studentId: string) => void;
  onTabChange?: (activeTab: string) => void;
}

export function AdminPanel({ user, onTabChange }: AdminPanelProps) {
  const [state, setState] = useState({ isAdmin: false, loading: true, showDataBuilder: false, error: null as string | null, data: { users: [] as AdminUser[], classes: [] as Class[], students: [] as Student[], teachers: [] as Teacher[], teacherCount: 0, adminCount: 0 }, openSections: { users: false, classes: true, students: true, incompleteReports: false }, teacherReportStats: {} as Record<string, { teacherName: string; teacherEmail: string; reportCount: number; studentCount: number }>, incompleteReports: [] as ReportData[], teacherDisplayNames: {} as Record<string, string> });

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
      const d = await loadAdminPanelData();
      setState(prev => ({
        ...prev,
        data: { users: d.users, classes: d.classes, students: d.students, teachers: d.teachers, teacherCount: d.teacherCount, adminCount: d.adminCount },
        teacherReportStats: d.teacherReportStats,
        incompleteReports: d.incompleteReports,
        teacherDisplayNames: d.teacherDisplayNames,
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
            <UsersSection
              open={state.openSections.users}
              onOpenChange={(isOpen) => handleBrowseAccordionChange('users', isOpen)}
              adminCount={state.data.adminCount}
              teacherCount={state.data.teacherCount}
              users={state.data.users as any}
            />
          )}
          {state.data.classes.length > 0 && (
            <ClassesSection
              open={state.openSections.classes}
              onOpenChange={(isOpen) => handleBrowseAccordionChange('classes', isOpen)}
              classes={state.data.classes as Class[]}
              teacherDisplayNames={state.teacherDisplayNames}
            />
          )}
        </TabsContent>
        <TabsContent value="build" className="space-y-4">
          <DataBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
