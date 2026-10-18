/** Resolve entry after a session lookup, preserving work already open in the app. */
export function resolveInitialScreen({sessionLoading, signedIn, hasSeenOnboarding, currentScreen}: {
  sessionLoading: boolean;
  signedIn: boolean;
  hasSeenOnboarding: boolean;
  currentScreen?: string;
}): 'vault' | 'onboarding' | null {
  if (sessionLoading) return null;
  if (currentScreen && !(signedIn && currentScreen === 'onboarding')) return null;
  return signedIn || hasSeenOnboarding ? 'vault' : 'onboarding';
}
