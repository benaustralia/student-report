import { useState, useEffect, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './hooks/useAuthContext';
import { Toaster } from '@/components/ui/sonner';
import { RBAApp } from './components/RBAApp';
import { LoginForm } from './components/LoginForm';

const GoogleAuthWrapper = lazy(() => import('./components/GoogleAuthWrapper').then(m => ({ default: m.GoogleAuthWrapper })));

const LoadingCard = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-4xl mx-auto p-4 sm:p-6">
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>{children}</span>
      </CardContent>
    </Card>
  </div>
);

function AppContent() {
  const { user, loading, error } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => { if (!user) setIsSigningIn(false); }, [user]);


  if (loading) return <LoadingCard>Loading...</LoadingCard>;

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <Card className="border-destructive">
          <CardContent className="text-destructive py-4">
            <p>Authentication Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Suspense fallback={<LoadingCard>Loading sign-in...</LoadingCard>}>
          <GoogleAuthWrapper>
            <LoginForm onSignIn={() => setIsSigningIn(false)} isSigningIn={isSigningIn} setIsSigningIn={setIsSigningIn} />
          </GoogleAuthWrapper>
        </Suspense>
      </div>
    );
  }

  return <RBAApp user={user} />;
}

export default function TeacherReports() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}