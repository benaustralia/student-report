import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import AuthComponent from './components/AuthComponent';
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
        <AuthComponent />
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