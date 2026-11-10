/** Use fixed copy so callback parameters cannot supply text shown to users. */
export function oauthErrorMessage(error: string | null): string | null {
  if (!error) return null;
  if (error === 'account_not_linked') {
    return 'This Google account is not linked to your Omnicook account. If you already have an Omnicook account with this email, verify your email and try again, or sign in with your password.';
  }
  return 'Google sign-in could not be completed. Please try again or sign in with your password.';
}
