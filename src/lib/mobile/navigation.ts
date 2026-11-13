export type CachedView = 'vault' | 'search' | 'community';
export type ViewCache = { owner: string; views: CachedView[] };
export type RecipeReturnScreen = CachedView | 'planner' | 'grocery';
export function retainedForOwner(cache: ViewCache, owner: string): CachedView[] {
  return cache.owner === owner ? cache.views : [];
}
// A fixed whitelist prevents recipe IDs from growing the cache.
export function retainView(cache: ViewCache, owner: string, screen: string): ViewCache {
  const current: ViewCache = cache.owner === owner ? cache : { owner, views: [] };
  if (screen !== 'vault' && screen !== 'search' && screen !== 'community') return current;
  return current.views.includes(screen) ? current : { owner, views: [...current.views, screen] };
}
export function recipeReturnScreen(screen: string): RecipeReturnScreen {
  return ['vault', 'search', 'community', 'planner', 'grocery'].includes(screen)
    ? screen as RecipeReturnScreen : 'vault';
}
export function recipeReturnLabel(screen: RecipeReturnScreen): string {
  return `Back to ${{vault:'cookbook',search:'search',community:'community',planner:'meal plan',grocery:'shopping list'}[screen]}`;
}
