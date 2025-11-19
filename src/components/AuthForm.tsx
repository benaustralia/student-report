import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleLogin } from '@react-oauth/google';
import { Loader2, Mail, Lock } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, resetPassword } from '../services/firebaseAuth';
import { toast } from 'sonner';

interface AuthFormProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  setIsSigningIn: (signingIn: boolean) => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSignIn, isSigningIn, setIsSigningIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle(credentialResponse.credential);
      onSignIn();
    } catch (error) {
      console.error('🔴 Google Sign-In error:', error);
      toast.error('Google sign-in failed. Please try again.');
      setIsSigningIn(false);
    }
  };

  const handleGoogleError = () => {
    console.error('🔴 Google Sign-In failed');
    toast.error('Google sign-in failed. Please try again.');
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);

    try {
      await signInWithEmail(email, password);
      toast.success('Signed in successfully!');
      onSignIn();
    } catch (error: any) {
      console.error('🔴 Email Sign-In error:', error);
      let errorMessage = 'Sign-in failed. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please contact an administrator to create an account.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      toast.error(errorMessage);
      setIsSigningIn(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast.error('Please enter your email address first');
      return;
    }

    setIsResettingPassword(true);
    try {
      await resetPassword(email);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      console.error('🔴 Password reset error:', error);
      toast.error('Failed to send password reset email. Please try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">NSA Student Reports</h2>
        <Card className="mx-auto max-w-md border-2 border-gray-300">
          <CardHeader>
            <CardTitle className="text-2xl text-black">Welcome back</CardTitle>
            <CardDescription className="text-gray-600">
              Sign in with your existing account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Google Sign In */}
              <div className="space-y-4">
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
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">Or continue with email</span>
                  </div>
                </div>
              </div>

              {/* Email Sign In Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-signin">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email-signin"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password-signin">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password-signin"
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
              </form>

              <Button
                variant="link"
                onClick={handlePasswordReset}
                disabled={isResettingPassword || !email}
                className="w-full text-sm"
              >
                {isResettingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Forgot your password?'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
