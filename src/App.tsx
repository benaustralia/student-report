import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { RBAApp } from './components/RBAApp';
import { signInWithGoogle } from './services/firebaseService';
import { useState, useEffect } from 'react';

// TypeScript declaration for Google Identity Services
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement | null, config: any) => void;
        };
      };
    };
  }
}

// Force refresh - modern Firebase auth implementation

function AppContent() {
  const { user, loading, error } = useAuthContext();
  const [googleLoaded, setGoogleLoaded] = useState(false);


  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleLoaded(true);
    script.onerror = (error) => {
      console.error('Failed to load Google Identity Services script:', error);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleCredentialResponse = async (response: any) => {
    try {
      // Use the ID token from Google Identity Services
      const credential = response.credential;
      await signInWithGoogle(credential);
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Sign in failed. Please try again.');
    }
  };

  useEffect(() => {
    if (googleLoaded && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: '1089251772494-s8a9lafg8ju91vvaq426bkvj5mon7vm9.apps.googleusercontent.com',
          callback: handleCredentialResponse,
        });
        
        // Render the button after a short delay to ensure DOM is ready
        setTimeout(() => {
          const buttonElement = document.getElementById('g_id_signin');
          if (buttonElement && window.google.accounts.id) {
            window.google.accounts.id.renderButton(buttonElement, {
              type: 'standard',
              size: 'large',
              theme: 'outline',
              text: 'sign_in_with',
              shape: 'rectangular',
              logo_alignment: 'left'
            });
          }
        }, 200);
      } catch (error) {
        console.error('Failed to initialize Google Identity Services:', error);
      }
    }
  }, [googleLoaded]);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-8 max-w-md mx-auto px-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Sign In Required</h2>
            <p className="text-gray-300 text-lg">
              Please sign in with your Google account to access the student reports.
            </p>
          </div>
          {googleLoaded ? (
            <div 
              id="g_id_signin"
              data-type="standard"
              data-size="large"
              data-theme="outline"
              data-text="sign_in_with"
              data-shape="rectangular"
              data-logo_alignment="left"
              className="flex justify-center"
            />
          ) : (
            <div className="flex items-center justify-center text-white">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              <span>Loading Google Sign-In...</span>
            </div>
          )}
        </div>
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