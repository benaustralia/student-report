export function mapAuthErrorToMessage(error: any): string {
  if (!error || !error.code) return 'Sign-in failed. Please try again.';
  switch (error.code) {
    case 'auth/user-not-found':
      return 'No account found with this email. Please contact an administrator to create an account.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
