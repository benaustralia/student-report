import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './hooks/useAuthContext';
import { RBAApp } from './components/RBAApp';
import { signInWithGoogle } from './services/firebaseService';
import { useState, useEffect } from 'react';

// TypeScript declaration for Google Identity Services
interface GoogleConfig {
  client_id: string;
  callback: (response: { credential: string }) => void;
}

interface GoogleButtonConfig {
  type: string;
  size: string;
  theme: string;
  text: string;
  shape: string;
  logo_alignment: string;
}

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: GoogleConfig) => void;
          renderButton: (element: HTMLElement | null, config: GoogleButtonConfig) => void;
          cancel: () => void;
        };
      };
    };
  }
}

// Force refresh - modern Firebase auth implementation

function AppContent() {
  const { user, loading, error } = useAuthContext();
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [buttonRendered, setButtonRendered] = useState(false);

  useEffect(() => {
    // Check if Google Identity Services is already loaded
    const checkGoogleLoaded = () => {
      if (window.google?.accounts?.id) {
        setGoogleLoaded(true);
      } else {
        // Retry after a short delay if not loaded yet
        setTimeout(checkGoogleLoaded, 100);
      }
    };

    checkGoogleLoaded();

    return () => {
      // Clean up Google Identity Services
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.cancel();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  const handleCredentialResponse = async (response: { credential: string }) => {
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
    // Only initialize and render Google Sign-In if user is not authenticated
    if (googleLoaded && window.google && !user && !buttonRendered) {
      try {
        window.google.accounts.id.initialize({
          client_id: '1089251772494-s8a9lafg8ju91vvaq426bkvj5mon7vm9.apps.googleusercontent.com',
          callback: handleCredentialResponse,
        });
        
        // Use a more reliable approach with requestAnimationFrame
        const renderButton = () => {
          // Double-check that user is still not authenticated before rendering
          if (user || buttonRendered) {
            return; // User is now authenticated or button already rendered
          }
          
          const buttonElement = document.getElementById('g_id_signin');
          if (buttonElement && window.google?.accounts?.id) {
            try {
              // Clear any existing content
              buttonElement.innerHTML = '';
              
              window.google.accounts.id.renderButton(buttonElement, {
                type: 'standard',
                size: 'large',
                theme: 'outline',
                text: 'sign_in_with',
                shape: 'rectangular',
                logo_alignment: 'left'
              });
              
              setButtonRendered(true);
            } catch (renderError) {
              // Only log errors in development mode
              if (import.meta.env.DEV) {
                console.error('Error rendering Google Sign-In button:', renderError);
              }
            }
          } else {
            // Use requestAnimationFrame for better timing
            requestAnimationFrame(renderButton);
          }
        };
        
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(renderButton);
      } catch (error) {
        console.error('Failed to initialize Google Identity Services:', error);
      }
    }
  }, [googleLoaded, user, buttonRendered]);

  // Reset button rendered state when user logs out
  useEffect(() => {
    if (!user) {
      setButtonRendered(false);
    }
  }, [user]);

  // Clean up Google Sign-In when user logs in
  useEffect(() => {
    if (user && window.google?.accounts?.id) {
      try {
        // Cancel any ongoing Google Identity Services operations
        window.google.accounts.id.cancel();
        setButtonRendered(false);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }, [user]);

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
              {googleLoaded ? (
                <div 
                  id="g_id_signin"
                  className="w-full flex justify-center"
                />
              ) : (
                <div className="flex items-center justify-center text-black">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  <span>Loading Google Sign-In...</span>
                </div>
              )}
            </div>
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