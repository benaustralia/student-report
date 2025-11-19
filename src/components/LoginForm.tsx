import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, Lock } from 'lucide-react'
import { signInWithGoogle, signInWithEmail, resetPassword } from '../services/firebaseAuth'
import { toast } from 'sonner'
import { useState } from 'react'

// Google OAuth button - only loads the script when user clicks
function GoogleLoginButton({ onSuccess, onError }: { onSuccess: (response: any) => void; onError: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [OAuthProvider, setOAuthProvider] = useState<any>(null);
  const [GoogleLoginComponent, setGoogleLoginComponent] = useState<any>(null);

  const handleClick = async () => {
    if (GoogleLoginComponent) return; // Already loaded
    
    setIsLoading(true);
    try {
      // Only load Google OAuth when user actually clicks the button
      // This prevents loading 90KB+ of unused code on page load
      const module = await import('@react-oauth/google');
      const { GoogleOAuthProvider, GoogleLogin } = module;
      
      // Set up provider and component
      setOAuthProvider(() => GoogleOAuthProvider);
      setGoogleLoginComponent(() => GoogleLogin);
    } catch (error) {
      console.error('Failed to load Google OAuth:', error);
      onError();
    } finally {
      setIsLoading(false);
    }
  };

  // Once loaded, render with provider
  if (OAuthProvider && GoogleLoginComponent) {
    const Provider = OAuthProvider;
    const Login = GoogleLoginComponent;
    return (
      <Provider clientId="1089251772494-s8a9lafg8ju91vvaq426bkvj5mon7vm9.apps.googleusercontent.com">
        <Login
          onSuccess={onSuccess}
          onError={onError}
          useOneTap={false}
          theme="outline"
          size="large"
          text="signin_with"
          shape="rectangular"
          logo_alignment="left"
        />
      </Provider>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </>
      )}
    </Button>
  );
}

interface LoginFormProps {
  className?: string
  onSignIn: () => void
  isSigningIn: boolean
  setIsSigningIn: (signingIn: boolean) => void
}

export function LoginForm({
  className,
  onSignIn,
  isSigningIn,
  setIsSigningIn,
  ...props
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsSigningIn(true)
    try {
      await signInWithGoogle(credentialResponse.credential)
      onSignIn()
    } catch (error) {
      console.error('🔴 Google Sign-In error:', error)
      toast.error('Google sign-in failed. Please try again.')
      setIsSigningIn(false)
    }
  }

  const handleGoogleError = () => {
    console.error('🔴 Google Sign-In failed')
    toast.error('Google sign-in failed. Please try again.')
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSigningIn(true)

    try {
      await signInWithEmail(email, password)
      toast.success('Signed in successfully!')
      onSignIn()
    } catch (error: any) {
      console.error('🔴 Email Sign-In error:', error)
      let errorMessage = 'Sign-in failed. Please try again.'
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please contact an administrator to create an account.'
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.'
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.'
      }
      
      toast.error(errorMessage)
      setIsSigningIn(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      toast.error('Please enter your email address first')
      return
    }

    setIsResettingPassword(true)
    try {
      await resetPassword(email)
      toast.success('Password reset email sent! Check your inbox.')
    } catch (error: any) {
      console.error('🔴 Password reset error:', error)
      toast.error('Failed to send password reset email. Please try again.')
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleEmailSignIn}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">NSA Student Reports</h1>
                <p className="text-balance text-muted-foreground">
                  Sign in to your account
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword || !email}
                    className="ml-auto text-sm underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {isResettingPassword ? 'Sending...' : 'Forgot your password?'}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required 
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isSigningIn}>
                {isSigningIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
              
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
              
              <div className="flex justify-center">
                {isSigningIn ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Signing you in...</span>
                  </div>
                ) : (
                  <GoogleLoginButton
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                  />
                )}
              </div>
            </div>
          </form>
          
          <div className="relative hidden bg-muted md:block">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Student Reports
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Manage and track student progress with ease
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
