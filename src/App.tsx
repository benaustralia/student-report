import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './hooks/useAuthContext';
import { signInWithGoogle } from './services/firebaseService-ultra-final';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Toaster } from '@/components/ui/sonner';
import { RBAApp } from './components/RBAApp';

function AppContent() {
  const { user, loading, error } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Reset signing in state when user changes
  useEffect(() => {
    if (!user) {
      setIsSigningIn(false);
    }
  }, [user]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle(credentialResponse.credential);
    } catch (error) {
      console.error('🔴 Sign in error:', error);
      alert('Sign in failed. Please try again.');
      setIsSigningIn(false);
    }
  };

  const handleGoogleError = () => {
    console.error('🔴 Google Sign-In failed');
  };


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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Card className="mx-auto max-w-sm border-2 border-gray-300">
          <CardHeader>
            <CardTitle className="text-2xl text-black">Welcome back</CardTitle>
            <CardDescription className="text-gray-600">
              Login with your Google account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              {isSigningIn ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Signing you in...</span>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  logo_alignment="left"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

        // Render RBAApp directly
        return <RBAApp user={user} />;
}

export default function TeacherReports() {
  return (
    <GoogleOAuthProvider clientId="1089251772494-s8a9lafg8ju91vvaq426bkvj5mon7vm9.apps.googleusercontent.com">
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}