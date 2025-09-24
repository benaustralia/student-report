import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TypographyH1, TypographyH2, TypographyMuted, TypographySmall } from '@/components/ui/typography';
import { Loader2, Users, Shield, LogOut } from 'lucide-react';
import { getAllClasses, isUserAdmin, getUserDisplayName } from '@/services/firebaseService';
import type { Class } from '@/types';
import type { User } from 'firebase/auth';
import { ClassCard } from './ClassCard';
import { TeacherCard } from './TeacherCard';
import { AdminPanel } from './AdminPanel';
import { ThemeToggle } from './theme-toggle';
import { useAuthContext } from '@/hooks/useAuthContext';

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

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Batch the admin check and classes loading
      const [adminStatus, allClasses] = await Promise.all([
        isUserAdmin(user.email || ''),
        getAllClasses()
      ]);
      
      
      setIsAdmin(adminStatus);
      
      if (adminStatus) {
        // For all admin users (admin-only and admin+teacher), use all classes and batch teacher name lookups
        setClasses(allClasses);
        
        const uniqueTeacherEmails = [...new Set(allClasses.map(cls => cls.teacherEmail))];
        const displayNames = await Promise.all(
          uniqueTeacherEmails.map(async (email) => ({ 
            email, 
            displayName: (await getUserDisplayName(email)) || 'Unknown Teacher' 
          }))
        );
        const displayNameMap = displayNames.reduce((acc, { email, displayName }) => ({ 
          ...acc, 
          [email]: displayName 
        }), {} as Record<string, string>);
        setTeacherDisplayNames(displayNameMap);
      } else {
        // For teacher-only users, filter classes by their email
        const teacherClasses = allClasses.filter(cls => cls.teacherEmail === user.email);
        setClasses(teacherClasses);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => {
    loadData();
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
    <div className="flex items-center justify-between">
      <div><TypographyH1>Student Reports</TypographyH1><TypographyMuted>{isAdmin ? 'Management View - All Classes' : 'Teacher View - Your Classes'}</TypographyMuted></div>
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
    {isAdmin && <AdminPanel user={user} />}
    <div className="space-y-4">
      <div className="flex items-center justify-between"><TypographyH2>{isAdmin ? 'All Classes' : 'Your Classes'} ({classes.length})</TypographyH2></div>
      {classes.length === 0 ? (
        <Card><CardContent className="text-center py-12"><Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground mb-4">{isAdmin ? 'No classes found in the system.' : 'No classes assigned to you yet. Contact your administrator.'}</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {isAdmin ? Object.values(classes.reduce((acc, classData) => {
            const teacherKey = `${classData.teacherEmail}`;
            if (!acc[teacherKey]) acc[teacherKey] = { teacherName: teacherDisplayNames[classData.teacherEmail] || 'Unknown Teacher', teacherEmail: classData.teacherEmail, classes: [] };
            acc[teacherKey].classes.push(classData);
            return acc;
          }, {} as Record<string, { teacherName: string; teacherEmail: string; classes: Class[] }>)).map((teacherData) => (
            <TeacherCard key={teacherData.teacherEmail} teacherName={teacherData.teacherName} teacherEmail={teacherData.teacherEmail} classes={teacherData.classes} isAdmin={isAdmin} />
          )) : classes.map((classData) => (
            <ClassCard key={classData.id} classData={classData} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
    <footer className="text-center py-4 border-t">
      <TypographySmall className="text-muted-foreground">Version 10</TypographySmall>
    </footer>
  </div>;
};
