import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Loader2, AlertCircle } from 'lucide-react';

// Google One Tap types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export const AuthComponent: React.FC = () => {
  const [oneTapInitialized, setOneTapInitialized] = useState<boolean>(false);
  const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef<number>(0);

  // Initialize Google Sign-In button when component mounts and button element is available
  useEffect(() => {
    if (!oneTapInitialized && buttonElement) {
      const initializeGoogleSignIn = () => {
        try {
          // Google OAuth Client ID from Firebase Console
          const clientId = '1089251772494-s8a9lafg8ju91vvaq426bkvj5mon7vm9.apps.googleusercontent.com';
          
          // Check if google.accounts.id is available
          if (!window.google?.accounts?.id) {
            console.error('Google accounts.id not available');
            setOneTapInitialized(true);
            return;
          }
          
          // Initialize Google Sign-In
          window.google.accounts.id.initialize({
            client_id: clientId,
            auto_select: false, // Prevent automatic sign-in
            callback: async (response: any) => {
              try {
                // Create a Google Auth Provider credential
                const credential = GoogleAuthProvider.credential(response.credential);
                
                // Sign in to Firebase with the credential
                await signInWithCredential(auth, credential);
                
                // The auth state change will be handled by the context
              } catch (error) {
                console.error('Error signing in with Google credential:', error);
                setError('Failed to sign in. Please try again.');
              }
            }
          });

          // Render the Google Sign-In button
          const renderButton = () => {
            if (buttonElement) {
              try {
                // Clear any existing content
                buttonElement.innerHTML = '';
                
                window.google?.accounts.id.renderButton(
                  buttonElement,
                  {
                    theme: 'outline',
                    size: 'large',
                    type: 'standard',
                    shape: 'rectangular',
                    text: 'signin_with',
                    logo_alignment: 'left'
                  }
                );
                setOneTapInitialized(true);
              } catch (renderError) {
                console.error('Error rendering Google Sign-In button:', renderError);
                // Retry with exponential backoff
                if (retryCountRef.current < 5) {
                  retryCountRef.current++;
                  setTimeout(renderButton, 200 * Math.pow(2, retryCountRef.current));
                } else {
                  console.error('Max retries reached, giving up on button rendering');
                  setOneTapInitialized(true);
                }
              }
            }
          };
          
          // Try to render immediately, then retry if needed
          setTimeout(renderButton, 100);
          setOneTapInitialized(true);
          
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error);
          setOneTapInitialized(true);
        }
      };

      // Wait for Google Identity Services to load
      if (window.google?.accounts?.id) {
        initializeGoogleSignIn();
      } else {
        const checkGoogle = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(checkGoogle);
            initializeGoogleSignIn();
          }
        }, 100);
        
        // Cleanup interval after 5 seconds
        setTimeout(() => {
          clearInterval(checkGoogle);
          if (!window.google?.accounts?.id) {
            console.error('Google Identity Services failed to load after 5 seconds');
            setOneTapInitialized(true);
          }
        }, 5000);
      }
    }
  }, [oneTapInitialized, buttonElement]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Sign In Required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-muted-foreground">
          Please sign in with your Google account to access the student reports.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div ref={(el) => setButtonElement(el)} className="flex justify-center">
            {/* Google Sign-In button will be rendered here */}
          </div>
          {!oneTapInitialized && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading sign-in button...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AuthComponent;