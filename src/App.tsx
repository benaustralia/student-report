import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { RBAApp } from './components/RBAApp';

// Force refresh - modern Firebase auth implementation

function AppContent() {
  const { user, loading, error } = useAuthContext();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in with your Google account to access the student reports.
            </p>
            <p className="text-sm text-muted-foreground">
              Authentication is handled automatically when you visit this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <RBAApp user={user} />;
}

export default function TeacherReports() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}