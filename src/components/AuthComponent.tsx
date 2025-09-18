import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signOutUser, onAuthStateChange, isUserWhitelisted } from '@/services/firebaseService';
import { auth } from '@/config/firebase';
import type { User } from 'firebase/auth';
import { Loader2, LogOut, User as UserIcon, AlertCircle } from 'lucide-react';

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

interface AuthComponentProps {
  onAuthChange: (user: User | null, isWhitelisted: boolean) => void;
}

export const AuthComponent: React.FC<AuthComponentProps> = ({ onAuthChange }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [oneTapInitialized, setOneTapInitialized] = useState<boolean>(false);
  const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(null);
  const retryCountRef = useRef<number>(0);

  useEffect(() => {
    console.log('AuthComponent: Setting up auth state listener');
    const unsubscribe = onAuthStateChange(async (user) => {
      console.log('AuthComponent: Auth state changed', user ? 'User logged in' : 'User logged out');
      setUser(user);
      setLoading(false);
      // Reset retry count when user state changes
      retryCountRef.current = 0;
      
      if (user) {
        try {
          console.log('AuthComponent: Checking whitelist for', user.email);
          const whitelisted = await isUserWhitelisted(user.email || '');
          console.log('AuthComponent: Whitelist result', whitelisted);
          setIsWhitelisted(whitelisted);
          onAuthChange(user, whitelisted);
        } catch (err) {
          console.error('Error checking whitelist:', err);
          setError('Failed to verify user access');
          setIsWhitelisted(false);
          onAuthChange(user, false);
        }
      } else {
        console.log('AuthComponent: No user, setting whitelisted to false');
        setIsWhitelisted(false);
        onAuthChange(null, false);
      }
    });

    return () => {
      console.log('AuthComponent: Cleaning up auth state listener');
      unsubscribe();
    };
  }, [onAuthChange]);

  // Initialize Google Sign-In button when component mounts and button element is available
  useEffect(() => {
    if (!user && !oneTapInitialized && buttonElement) {
      console.log('AuthComponent: Attempting to initialize Google Sign-In button');
      
      const initializeGoogleSignIn = () => {
        try {
          console.log('AuthComponent: Google Identity Services loaded, initializing sign-in button');
          // Google OAuth Client ID from Firebase Console
          const clientId = '1089251772494-s8a9lafg8ju91vvaq426bkvj5mon7vm9.apps.googleusercontent.com';
          
          // Check if google.accounts.id is available
          if (!window.google?.accounts?.id) {
            console.error('Google accounts.id not available');
            setOneTapInitialized(true);
            return;
          }
          
          console.log('AuthComponent: Initializing Google Sign-In with client ID:', clientId);
          
          // Initialize Google Sign-In
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              try {
                console.log('Google Sign-In response received:', response);
                
                // Create a Google Auth Provider credential
                const { GoogleAuthProvider } = await import('firebase/auth');
                const credential = GoogleAuthProvider.credential(response.credential);
                
                // Sign in to Firebase with the credential
                const { signInWithCredential } = await import('firebase/auth');
                const result = await signInWithCredential(auth, credential);
                
                console.log('Firebase sign-in successful:', result.user);
                console.log('User email:', result.user.email);
                console.log('User UID:', result.user.uid);
                
                // The onAuthStateChanged listener should handle the rest
                setOneTapInitialized(true);
              } catch (error) {
                console.error('Error signing in with Google credential:', error);
                setError('Failed to sign in. Please try again.');
                setOneTapInitialized(true);
              }
            }
          });

          // Wait for DOM to be ready, then render the Google Sign-In button
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
                console.log('Google Sign-In button rendered successfully');
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
            } else {
              console.error('Button element not available, retrying...');
              // Retry with exponential backoff
              if (retryCountRef.current < 5) {
                retryCountRef.current++;
                setTimeout(renderButton, 200 * Math.pow(2, retryCountRef.current));
              } else {
                console.error('Max retries reached, giving up on button rendering');
                setOneTapInitialized(true);
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
        console.log('AuthComponent: Google Identity Services already loaded');
        initializeGoogleSignIn();
      } else {
        console.log('AuthComponent: Waiting for Google Identity Services to load');
        const checkGoogle = setInterval(() => {
          if (window.google?.accounts?.id) {
            console.log('AuthComponent: Google Identity Services loaded after waiting');
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
  }, [user, oneTapInitialized, buttonElement]);

  // One Tap will handle sign-in automatically

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
      setError('Failed to sign out. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading...</span>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
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
            <div className="text-center text-sm text-muted-foreground">
              Sign in with your Google account:
            </div>
            <div ref={(el) => setButtonElement(el)} className="flex justify-center">
              {/* Google Sign-In button will be rendered here */}
            </div>
            {!oneTapInitialized && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading sign-in button...</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground text-center">
              Debug: oneTapInitialized = {oneTapInitialized.toString()}, Google loaded = {window.google ? 'yes' : 'no'}, Button element = {buttonElement ? 'yes' : 'no'}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isWhitelisted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-destructive">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Your account is not authorized to access this application.</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Please contact the administrator to request access.
          </p>
          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            className="w-full"
            disabled={loading}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Welcome!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <UserIcon className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{user.displayName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        <Button 
          onClick={handleSignOut} 
          variant="outline" 
          className="w-full"
          disabled={loading}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </CardContent>
    </Card>
  );
};

export default AuthComponent;
