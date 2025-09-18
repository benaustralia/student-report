import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import AuthComponent from './components/AuthComponent';
import { RBAApp } from './components/RBAApp';
import type { User } from 'firebase/auth';

export default function TeacherReports() {
  const [user, setUser] = useState<User | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const handleAuthChange = (user: User | null, whitelisted: boolean) => {
    setUser(user);
    setIsWhitelisted(whitelisted);
    setLoading(false);
  };

  // Show AuthComponent if no user, or if user exists but whitelist check failed
  // Don't show it while whitelist check is in progress (loading state)
  if (!user || (user && !isWhitelisted && !loading)) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <AuthComponent onAuthChange={handleAuthChange} />
      </div>
    );
  }

  if (loading) {
    console.log('App: Rendering loading state', { user: user?.email, isWhitelisted, loading });
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

  return <RBAApp user={user} />;
}