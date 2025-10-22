import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypographyH1, TypographyMuted, TypographySmall } from '@/components/ui/typography';
import { Loader2, Users, Shield, LogOut, ChevronDown, ChevronRight, GraduationCap, Database } from 'lucide-react';
import { getAllClasses, isUserAdmin, getUserDisplayName, prefetchCriticalData, getStudentsForClass } from '@/services/firebaseService-ultra-final';
import type { Class } from '@/types';
import type { User } from 'firebase/auth';
import { ClassCard } from './ClassCard';
import { TeacherCard } from './TeacherCard';
import { ThemeToggle } from './theme-toggle';
import { useAuthContext } from '@/hooks/useAuthContext';
import { BuzzingBee } from './BuzzingBee';

// Lazy load AdminPanel for better performance
const AdminPanel = React.lazy(() => import('./AdminPanel').then(module => ({ default: module.AdminPanel })));

interface RBAAppProps { user: User; }

export const RBAApp: React.FC<RBAAppProps> = ({ user }) => {
  const { signOut } = useAuthContext();
  
  // Split large state into focused pieces
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [teacherDisplayNames, setTeacherDisplayNames] = useState<Record<string, string>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({ adminPanel: true, allClasses: true });
  const [activeAdminTab, setActiveAdminTab] = useState('browse');
  
  // Prevent duplicate loading in React strict mode
  const isLoadingRef = React.useRef(false);


  const handleNavigateToStudent = async (studentId: string) => {
    setSelectedStudentId(studentId);
    
    try {
      // First, find which class contains this student
      
      for (const classData of classes) {
        const students = await getStudentsForClass(classData.id);
        if (students.some((student: any) => student.id === studentId)) {
          // First expand the teacher card
          window.dispatchEvent(new CustomEvent('expandTeacherForStudent', { 
            detail: { teacherEmail: classData.teacherEmail, classId: classData.id, studentId } 
          }));
          
          // Wait for teacher card to expand, then dispatch class expansion event
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('expandClassForStudent', { 
              detail: { classId: classData.id, studentId } 
            }));
          }, 200);
          
          // Quick scroll to student with minimal delay
          const scrollToStudent = (attempts = 0) => {
            const studentElement = document.querySelector(`[data-student-id="${studentId}"]`);
            
            if (studentElement) {
              studentElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
              return;
            }
            
            if (attempts < 10) {
              setTimeout(() => scrollToStudent(attempts + 1), 100);
            }
          };
          
          // Start scrolling after a delay to allow for teacher and class expansion
          setTimeout(() => scrollToStudent(), 500);
          return;
        }
      }
    } catch (error) {
      console.error('Error finding student:', error);
    }
  };

  const loadData = React.useCallback(async () => {
    // Prevent duplicate loading in React strict mode
    if (isLoadingRef.current) {
      return;
    }
    
    isLoadingRef.current = true;
    const loadStartTime = Date.now();
    console.log('🚀 RBAApp loadData START:', {
      timestamp: new Date().toISOString(),
      userEmail: user.email
    });
    
    try {
      setLoading(true);
      setError(null);
      
      // Load critical data first (admin check and classes)
      const criticalStartTime = Date.now();
      
      const [adminStatus, allClasses] = await Promise.all([
        isUserAdmin(user.email || ''),
        getAllClasses()
      ]);
      
      const criticalDuration = Date.now() - criticalStartTime;
      console.log('🚀 Critical data loaded:', {
        duration: `${criticalDuration}ms`,
        adminStatus,
        classesCount: allClasses.length
      });
      
      setIsAdmin(adminStatus);
      
      if (adminStatus) {
        // For all admin users, use all classes
        setClasses(allClasses);
        
        // Set loading to false immediately after classes are loaded
        setLoading(false);
        
        // Load teacher names in background (non-blocking)
        const teacherStartTime = Date.now();
        const uniqueTeacherEmails = [...new Set(allClasses.map(cls => cls.teacherEmail))];
        
        console.log('🚀 Starting teacher name lookups:', {
          teacherCount: uniqueTeacherEmails.length,
          emails: uniqueTeacherEmails
        });
        
        Promise.all(
          uniqueTeacherEmails.map(async (email) => ({ 
            email, 
            displayName: (await getUserDisplayName(email)) || 'Unknown Teacher' 
          }))
        ).then(displayNames => {
          const teacherDuration = Date.now() - teacherStartTime;
          console.log('🚀 Teacher names loaded:', {
            duration: `${teacherDuration}ms`,
            count: displayNames.length,
            totalLoadTime: `${Date.now() - loadStartTime}ms`
          });
          
          const displayNameMap = displayNames.reduce((acc, { email, displayName }) => ({ 
            ...acc, 
            [email]: displayName 
          }), {} as Record<string, string>);
          setTeacherDisplayNames(displayNameMap);
        });
      } else {
        // For teacher-only users, filter classes by their email
        const teacherClasses = allClasses.filter(cls => cls.teacherEmail === user.email);
        setClasses(teacherClasses);
        setLoading(false);
        console.log('🚀 Teacher-only user - classes filtered and loaded:', {
          duration: `${Date.now() - criticalStartTime}ms`,
          classesCount: teacherClasses.length
        });
      }
    } catch (err) {
      const errorDuration = Date.now() - loadStartTime;
      console.error('🚀 RBAApp loadData ERROR:', {
        duration: `${errorDuration}ms`,
        error: err
      });
      setError('Failed to load data');
      setLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, [user.email]);

  useEffect(() => {
    loadData();
    
    // Start background prefetching after initial load
    const prefetchTimer = setTimeout(() => {
      prefetchCriticalData();
    }, 2000); // Start prefetching 2 seconds after initial load
    
    return () => clearTimeout(prefetchTimer);
  }, [loadData]);

  // Listen for data changes from DataBuilder
  useEffect(() => {
    const handleDataChanged = (event: CustomEvent) => {
      const { type } = event.detail;
      console.log(`RBAApp: Data changed for type: ${type}, checking if refresh needed...`);
      
      // Only reload data for changes that affect the main app view
      // Skip individual student deletions and class updates to prevent unnecessary refreshes
      if (type === 'users' || type === 'teachers') {
        console.log(`RBAApp: Refreshing for ${type}`);
        loadData();
      } else if (type === 'classes') {
        // For classes, only reload if it's not an update (to avoid refreshing the whole app)
        const { action } = event.detail;
        if (action !== 'update') {
          console.log(`RBAApp: Refreshing for class ${action}`);
          loadData();
        } else {
          console.log(`RBAApp: Skipping refresh for class update`);
        }
      } else if (type === 'students') {
        // For students, only reload if it's not a deletion or bulk import (to avoid refreshing the whole app)
        const { action } = event.detail;
        if (action !== 'delete' && action !== 'bulk_import') {
          console.log(`RBAApp: Refreshing for student ${action}`);
          loadData();
        } else {
          console.log(`RBAApp: Skipping refresh for student ${action}`);
        }
      }
    };

    window.addEventListener('dataChanged', handleDataChanged as EventListener);
    return () => {
      window.removeEventListener('dataChanged', handleDataChanged as EventListener);
    };
  }, [loadData]);


  const handleSignOut = async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading) return <div className="max-w-6xl mx-auto p-4 sm:p-6"><Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin mr-2" /><span>Loading your data...</span></CardContent></Card></div>;
  if (error) return <div className="max-w-6xl mx-auto p-4 sm:p-6"><Card className="border-destructive"><CardContent className="text-destructive py-4">{error}</CardContent></Card></div>;

  return <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
    <BuzzingBee />
    <div className="flex items-center justify-between">
      <div><TypographyH1>Report-o-matic</TypographyH1><TypographyMuted>{isAdmin ? 'Management View' : 'Teacher View - Your Classes'}</TypographyMuted></div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button 
            variant="outline" 
            onClick={handleSignOut} 
            disabled={isSigningOut}
            aria-label={isSigningOut ? 'Signing out...' : 'Sign out of account'}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Shield className="h-4 w-4 text-muted-foreground" />
              <TypographySmall className="text-muted-foreground">Admin</TypographySmall>
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
    {isAdmin && (
      <Card>
        <Collapsible open={openSections.adminPanel} onOpenChange={() => setOpenSections(prev => ({ ...prev, adminPanel: !prev.adminPanel }))}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 flex-shrink-0" />
                  <span>Admin Panel</span>
                </CardTitle>
                {openSections.adminPanel ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Suspense fallback={<div className="p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <AdminPanel user={user} onNavigateToStudent={handleNavigateToStudent} onTabChange={setActiveAdminTab} />
              </Suspense>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )}
    {activeAdminTab !== 'build' && (
      <Card>
      <Collapsible open={openSections.allClasses} onOpenChange={() => setOpenSections(prev => ({ ...prev, allClasses: !prev.allClasses }))}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 flex-shrink-0" />
                <span>{isAdmin ? 'All Classes' : 'Your Classes'}</span>
                <Badge variant="secondary" className="text-xs">{classes.length}</Badge>
              </CardTitle>
              {openSections.allClasses ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {classes.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {isAdmin ? 'No classes found in the system.' : 'No classes assigned to you yet. Contact your administrator.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {isAdmin ? Object.values(classes.reduce((acc, classData) => {
                  const teacherKey = `${classData.teacherEmail}`;
                  if (!acc[teacherKey]) acc[teacherKey] = { teacherName: teacherDisplayNames[classData.teacherEmail] || 'Unknown Teacher', teacherEmail: classData.teacherEmail, classes: [] };
                  acc[teacherKey].classes.push(classData);
                  return acc;
                }, {} as Record<string, { teacherName: string; teacherEmail: string; classes: Class[] }>)).map((teacherData) => (
                  <TeacherCard key={teacherData.teacherEmail} teacherName={teacherData.teacherName} teacherEmail={teacherData.teacherEmail} classes={teacherData.classes} selectedStudentId={selectedStudentId} onStudentSelected={handleNavigateToStudent} />
                )) : classes.map((classData) => (
                  <ClassCard key={classData.id} classData={classData} selectedStudentId={selectedStudentId} onStudentSelected={handleNavigateToStudent} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
    )}
    <footer className="text-center py-4 border-t">
      <TypographySmall className="text-muted-foreground">V. 35 - by hand and Cursor.ai with love Wenli and Ben</TypographySmall>
    </footer>
  </div>;
};