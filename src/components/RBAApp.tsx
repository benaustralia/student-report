import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { TypographyH1, TypographyMuted, TypographySmall } from '@/components/ui/typography';
import { Loader2, Users, LogOut, ChevronDown, ChevronRight, GraduationCap, Database } from 'lucide-react';
import { getAllClasses, isUserAdmin, getUserDisplayName, prefetchCriticalData, getStudentsForClass } from '@/services/firebaseService-ultra-final';
import type { Class } from '@/types';
import type { User } from 'firebase/auth';
import { ThemeToggle } from './theme-toggle';
import { useAuthContext } from '@/hooks/useAuthContext';
import { ClassCard } from './ClassCard';
import { TeacherCard } from './TeacherCard';

// Lazy load ONLY non-critical components (below fold, behind interactions)
const AdminPanel = React.lazy(() => import('./AdminPanel').then(module => ({ default: module.AdminPanel })));
const BuzzingBee = React.lazy(() => import('./BuzzingBee').then(module => ({ default: module.BuzzingBee })));

interface RBAAppProps { user: User; }

export const RBAApp: React.FC<RBAAppProps> = ({ user }) => {
  const { signOut } = useAuthContext();
  const isLoadingRef = React.useRef(false);
  
  const [state, setState] = useState({
    classes: [] as Class[],
    loading: true,
    error: null as string | null,
    isAdmin: false,
    isSigningOut: false,
    teacherDisplayNames: {} as Record<string, string>,
    selectedStudentId: null as string | null,
    openSections: { adminPanel: false, allClasses: false },
    activeAdminTab: 'browse',
    openClassCardId: null as string | null
  });

  const handleAccordionChange = (section: 'adminPanel' | 'allClasses', isOpen: boolean) => 
    setState(prev => ({
      ...prev,
      openSections: isOpen 
        ? { adminPanel: section === 'adminPanel', allClasses: section === 'allClasses' }
        : { ...prev.openSections, [section]: false }
    }));

  const handleClassCardToggle = (classId: string, isOpen: boolean) => 
    setState(prev => ({ ...prev, openClassCardId: isOpen ? classId : null }));


  const handleNavigateToStudent = async (studentId: string) => {
    setState(prev => ({ ...prev, selectedStudentId: studentId }));
    
    try {
      for (const classData of state.classes) {
        const students = await getStudentsForClass(classData.id);
        if (students.some((student: any) => student.id === studentId)) {
          window.dispatchEvent(new CustomEvent('expandTeacherForStudent', { 
            detail: { teacherEmail: classData.teacherEmail, classId: classData.id, studentId } 
          }));
          
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('expandClassForStudent', { detail: { classId: classData.id, studentId } }));
          }, 200);
          
          const scrollToStudent = (attempts = 0) => {
            const el = document.querySelector(`[data-student-id="${studentId}"]`);
            if (el) return el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (attempts < 10) setTimeout(() => scrollToStudent(attempts + 1), 100);
          };
          
          setTimeout(() => scrollToStudent(), 500);
          return;
        }
      }
    } catch (error) {
      console.error('Error finding student:', error);
    }
  };

  const loadData = React.useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const [adminStatus, allClasses] = await Promise.all([isUserAdmin(user.email || ''), getAllClasses()]);
      
      const classes = adminStatus ? allClasses : allClasses.filter(cls => cls.teacherEmail === user.email);
      setState(prev => ({ ...prev, isAdmin: adminStatus, classes, loading: false }));
      
      if (adminStatus) {
        const uniqueTeacherEmails = [...new Set(allClasses.map(cls => cls.teacherEmail))];
        Promise.all(uniqueTeacherEmails.map(async email => [email, await getUserDisplayName(email) || 'Unknown Teacher']))
          .then(entries => setState(prev => ({ ...prev, teacherDisplayNames: Object.fromEntries(entries) })));
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Failed to load data', loading: false }));
    } finally {
      isLoadingRef.current = false;
    }
  }, [user.email]);

  useEffect(() => {
    // Force refresh data when user logs in to get latest student counts
    loadData();
    
    // Start background prefetching after initial load
    const prefetchTimer = setTimeout(() => {
      prefetchCriticalData();
    }, 2000); // Start prefetching 2 seconds after initial load
    
    return () => clearTimeout(prefetchTimer);
  }, [loadData]);

  useEffect(() => {
    const handleDataChanged = (event: CustomEvent) => {
      const { type, action } = event.detail;
      const shouldReload = 
        ['users', 'teachers'].includes(type) ||
        (type === 'classes' && action !== 'update') ||
        (type === 'students' && !['delete', 'bulk_import'].includes(action)) ||
        (type === 'requests' && action === 'approve');
      
      if (shouldReload) loadData();
    };

    window.addEventListener('dataChanged', handleDataChanged as EventListener);
    return () => window.removeEventListener('dataChanged', handleDataChanged as EventListener);
  }, [loadData]);


  const handleSignOut = async () => {
    if (state.isSigningOut) return;
    try {
      setState(prev => ({ ...prev, isSigningOut: true }));
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setState(prev => ({ ...prev, isSigningOut: false }));
    }
  };

  if (state.loading) return <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6" style={{minHeight: '100vh'}}>
    {/* BuzzingBee is position:fixed - no space needed */}
    
    {/* Header - SHOW REAL CONTENT (doesn't depend on data loading) */}
    <div className="flex items-center justify-between">
      <div>
        <TypographyH1>Report-o-matic</TypographyH1>
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
    
    {/* Admin Panel placeholder - COLLAPSED state (matches initial openSections.adminPanel: false) */}
    <Card className="min-h-[74px]">
      <CardHeader className="py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      </CardHeader>
    </Card>
    
    {/* All Classes placeholder - collapsed state (matches initial openSections.allClasses: false) */}
    <Card className="min-h-[74px]">
      <CardHeader className="py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      </CardHeader>
    </Card>
  </div>;
  if (state.error) return <div className="max-w-6xl mx-auto p-4 sm:p-6"><Card className="border-destructive"><CardContent className="text-destructive py-4">{state.error}</CardContent></Card></div>;

  return <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
    <Suspense fallback={null}>
      <BuzzingBee />
    </Suspense>
    
    <div className="flex items-center justify-between">
      <div><TypographyH1>Report-o-matic</TypographyH1><TypographyMuted>{state.isAdmin ? '' : 'Teacher View - Your Classes'}</TypographyMuted></div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button 
            variant="outline" 
            onClick={handleSignOut} 
            disabled={state.isSigningOut}
            aria-label={state.isSigningOut ? 'Signing out...' : 'Sign out of account'}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {state.isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {user.email}
        </div>
        <div className="flex items-center gap-2">
          {state.isAdmin ? (
            <>
            </>
          ) : (
            <>
              <Users className="h-4 w-4 text-muted-foreground" />
              <TypographySmall className="text-muted-foreground">Teacher</TypographySmall>
            </>
          )}
        </div>
      </div>
    </div>
    {state.isAdmin && (
      <Card>
        <Collapsible open={state.openSections.adminPanel} onOpenChange={(isOpen) => handleAccordionChange('adminPanel', isOpen)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 flex-shrink-0" />
                  <span>Admin Panel</span>
                </CardTitle>
                {state.openSections.adminPanel ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Suspense fallback={<div className="p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <AdminPanel user={user} onNavigateToStudent={handleNavigateToStudent} onTabChange={tab => setState(prev => ({ ...prev, activeAdminTab: tab }))} />
              </Suspense>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )}
    {state.activeAdminTab !== 'build' && (
      <Card>
      <Collapsible open={state.openSections.allClasses} onOpenChange={(isOpen) => handleAccordionChange('allClasses', isOpen)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 flex-shrink-0" />
                <span>{state.isAdmin ? 'All Classes' : 'Your Classes'}</span>
                <Badge variant="secondary" className="text-xs">{state.classes.length}</Badge>
              </CardTitle>
              {state.openSections.allClasses ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {state.classes.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {state.isAdmin ? 'No classes found in the system.' : 'No classes assigned to you yet. Contact your administrator.'}
                </p>
              </div>
            ) : (
            <div className="space-y-4">
              {state.isAdmin ? Object.values(state.classes.reduce((acc, classData) => {
                const teacherKey = `${classData.teacherEmail}`;
                if (!acc[teacherKey]) acc[teacherKey] = { teacherName: state.teacherDisplayNames[classData.teacherEmail] || 'Unknown Teacher', teacherEmail: classData.teacherEmail, classes: [] };
                acc[teacherKey].classes.push(classData);
                return acc;
              }, {} as Record<string, { teacherName: string; teacherEmail: string; classes: Class[] }>)).map((teacherData) => (
                <TeacherCard
                  key={teacherData.teacherEmail}
                  teacherName={teacherData.teacherName}
                  teacherEmail={teacherData.teacherEmail}
                  classes={teacherData.classes}
                  selectedStudentId={state.selectedStudentId}
                  onStudentSelected={handleNavigateToStudent}
                  openClassCardId={state.openClassCardId}
                  onClassCardToggle={handleClassCardToggle}
                />
              )) : state.classes.map((classData) => (
                <ClassCard
                  key={classData.id}
                  classData={classData}
                  selectedStudentId={state.selectedStudentId}
                  onStudentSelected={handleNavigateToStudent}
                  isOpen={state.openClassCardId === classData.id}
                  onToggle={(isOpen) => handleClassCardToggle(classData.id, isOpen)}
                />
              ))}
            </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
    )}
    <footer className="text-center py-4 border-t">
      <TypographySmall className="text-muted-foreground">
        {__GIT_BRANCH__}/{__APP_VERSION__} - by hand and Cursor.ai with love Wenli and Ben
      </TypographySmall>
    </footer>
  </div>;
};