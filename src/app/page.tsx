'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { s } from '@/lib/mobile/style';
import {
  COLLECTION_GLYPHS, COLLECTION_PALETTE, DAYS, DEMO_COLLECTIONS, DEMO_RECIPES,
  EXTRACT_STEPS, FILTERS, GROUPS, matchesFilter, scaleAmount, type Aisle, type MobileRecipe,
} from '@/lib/mobile/demo-data';
import { vaultToMobile } from '@/lib/mobile/adapters';
import { AUTH_CONFIGURED, useSession } from '@/lib/auth/session';
import { resolveInitialScreen } from '@/lib/auth/startup';
import {
  createCollection, createRecipeFromDraft, deleteRecipe, listCollections, listMealPlanItems, listRecipes,
  updateRecipe, uploadRecipePhoto, upsertMealPlanItem, type Collection, type MealPlanItem, type VaultRecipe,
} from '@/lib/api/client';
import type { RecipeDraft } from '@/lib/recipe-schema';
import { BannerAd } from '@/components/ads/BannerAd';
import { InterstitialAd } from '@/components/ads/InterstitialAd';
import { useInterstitial } from '@/lib/ads/useInterstitial';
import { GAM_BANNER_DETAIL_UNIT, GAM_BANNER_TABBAR_UNIT } from '@/lib/ads/gpt';
import { RecipeImage } from '@/components/RecipeImage';
import { KitchenIcon, type KitchenIconName } from '@/components/KitchenIcon';
import { prepareCookingPhoto } from '@/lib/photos/client-upload';
import { buildImportReportEmail, failedLinkReport, importReportRecipient, type FailedLinkReport } from '@/lib/import-report';

type Screen = 'onboarding' | 'vault' | 'search' | 'import' | 'extracting' | 'review' | 'edit' | 'detail' | 'cook' | 'planner' | 'grocery' | 'profile';
type Layout = 'grid' | 'feed' | 'editorial';

const INK = '#1b2b43', GREEN = '#3158cf', LIME = '#e8efa6', CORAL = '#3158cf', PAPER = '#f8fafc', CARD = '#ffffff', LINE = '#e2e7ef', MUTED = '#647187';
const SCROLL = 'overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain';
const TOP_SAFE = 'calc(env(safe-area-inset-top,0px) + 20px)';
const BOTTOM_SAFE = '28px';

function currentWeek() {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return DAYS.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { day, short: day.slice(0, 3), iso: d.toISOString().slice(0, 10) };
  });
}

function blankDraft(): RecipeDraft {
  return {
    title: '', creator: null, category: 'Other', prepMinutes: null, cookMinutes: null, servings: null,
    ingredients: [{ position: 0, quantity: null, unit: null, name: '', notes: null, aisle: 'Pantry' }],
    steps: [{ position: 0, instruction: '' }],
  };
}

const AISLES: Aisle[] = ['Produce', 'Dairy & chilled', 'Pantry'];
const AISLE_SHORT: Record<Aisle, string> = { Produce: 'Produce', 'Dairy & chilled': 'Dairy', Pantry: 'Pantry' };

const pill = (on: boolean) => (on ? { bg: INK, fg: '#fff' } : { bg: 'transparent', fg: MUTED });
const seg = (on: boolean) => (on ? { bg: GREEN, fg: '#fff' } : { bg: 'transparent', fg: MUTED });

export default function Home() {
  const configured = AUTH_CONFIGURED;
  const { user, loading: sessionLoading } = useSession();
  const signedIn = configured && !sessionLoading && Boolean(user);

  const [bootChecked, setBootChecked] = useState(false);
  const [screen, setScreen] = useState<Screen>('vault');
  const [layout, setLayout] = useState<Layout>('grid');
  const [filter, setFilter] = useState('All recipes');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [cookStep, setCookStep] = useState(0);
  const [chefQuestion, setChefQuestion] = useState('');
  const [chefReply, setChefReply] = useState('');
  const [chefLoading, setChefLoading] = useState(false);
  const [source, setSource] = useState('');
  const [failedImport, setFailedImport] = useState<FailedLinkReport | null>(null);
  const [reportNote, setReportNote] = useState('');
  const reportEmail = failedImport
    ? buildImportReportEmail(importReportRecipient(process.env.NEXT_PUBLIC_IMPORT_REPORT_EMAIL), failedImport, reportNote)
    : null;
  const [importing, setImporting] = useState(false);
  const [extractIdx, setExtractIdx] = useState(0);
  const [extractSeconds, setExtractSeconds] = useState<number | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{ draft: RecipeDraft; sourceUrl: string | null; imageUrl: string | null } | null>(null);
  const [editRecipeId, setEditRecipeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [vaultRecipes, setVaultRecipes] = useState<VaultRecipe[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlanItem[]>([]);
  const [collectionsState, setCollectionsState] = useState<Collection[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [demoPlan, setDemoPlan] = useState<Record<string, string | null>>({ Monday: 'd1', Tuesday: 'd2', Wednesday: null, Thursday: 'd3', Friday: null, Saturday: null, Sunday: 'd4' });
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [deletingRecipe, setDeletingRecipe] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const extractTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { interstitialOpen, guardNavigate, closeInterstitial } = useInterstitial();

  useEffect(() => {
    if (sessionLoading) return;
    let hasSeenOnboarding = false;
    try { hasSeenOnboarding = Boolean(window.localStorage.getItem('omnicook_onboarded')); }
    catch { /* A storage preference must not prevent an authenticated session from opening. */ }
    const initial = resolveInitialScreen({sessionLoading, signedIn, hasSeenOnboarding, currentScreen:bootChecked ? screen : undefined});
    if (!initial) return;
    setScreen(initial);
    setBootChecked(true);
  }, [bootChecked, sessionLoading, signedIn, screen]);

  async function refreshVault() {
    setLoadingVault(true);
    try {
      const [recipes, plan, collectionsList] = await Promise.all([listRecipes(), listMealPlanItems(), listCollections()]);
      setVaultRecipes(recipes);
      setMealPlan(plan);
      setCollectionsState(collectionsList);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load your vault.');
    } finally {
      setLoadingVault(false);
    }
  }

  useEffect(() => {
    if (signedIn) refreshVault();
    else { setVaultRecipes([]); setMealPlan([]); setCollectionsState([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(() => () => { if (extractTimer.current) clearInterval(extractTimer.current); }, []);

  useEffect(() => {
    if (!signedIn || !vaultRecipes.some(recipe => recipe.photoPending)) return;
    const timer = setTimeout(() => {
      listRecipes().then(setVaultRecipes).catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, [signedIn, vaultRecipes]);

  async function addCookingPhoto(file: File, recipeId: string) {
    if (uploadingPhoto) return;
    setUploadingPhoto(true);
    setPhotoStatus(null);
    try {
      await uploadRecipePhoto(recipeId, await prepareCookingPhoto(file));
      await refreshVault();
      setPhotoStatus('Your cooking photo is saved.');
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : 'Could not save your photo.');
    } finally {setUploadingPhoto(false);}
  }

  const recipes: MobileRecipe[] = signedIn ? vaultRecipes.map(vaultToMobile) : DEMO_RECIPES;
  const active = recipes.find((r) => r.id === activeId) ?? recipes[0];
  const weekDates = useMemo(currentWeek, []);

  const weekRecipes = useMemo(() => weekDates.map((d) => {
    const id = signedIn ? mealPlan.find((mp) => mp.plannedFor === d.iso)?.recipeId : demoPlan[d.day];
    return recipes.find((r) => r.id === id) ?? null;
  }), [weekDates, mealPlan, demoPlan, recipes, signedIn]);

  const groceryNames = useMemo(() => {
    const set = new Set<string>();
    weekRecipes.forEach((r) => r?.a.forEach((ingredient) => set.add(ingredient.name)));
    return [...set];
  }, [weekRecipes]);

  const grocerySections = useMemo(() => {
    const sections: Record<Aisle, string[]> = { Produce: [], 'Dairy & chilled': [], Pantry: [] };
    const seen = new Set<string>();
    weekRecipes.forEach((r) => r?.a.forEach((ingredient) => {
      if (seen.has(ingredient.name)) return;
      seen.add(ingredient.name);
      sections[ingredient.aisle].push(ingredient.name);
    }));
    return (Object.entries(sections) as [Aisle, string[]][]).filter(([, items]) => items.length > 0);
  }, [weekRecipes]);

  const plannedCount = weekRecipes.filter(Boolean).length;
  const filteredVault = recipes.filter((r) => matchesFilter(r, filter));
  const showVaultCards = filteredVault.length > 0;
  const vaultEmptyTitle = loadingVault
    ? 'Loading your saved recipes...'
    : signedIn && vaultRecipes.length === 0
      ? 'No saved recipes yet'
      : 'No recipes match this view';
  const vaultEmptyDetail = loadingVault
    ? 'Your vault is syncing from Omnicook.'
    : signedIn && vaultRecipes.length === 0
      ? 'Your account is connected, but this vault does not have saved recipes yet.'
      : 'Try All recipes or a different group.';
  const filteredSearch = recipes.filter((r) =>
    (collectionFilter ? r.collectionId === collectionFilter : matchesFilter(r, filter))
    && JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  const collectionDefs = signedIn ? collectionsState : DEMO_COLLECTIONS;
  const collections = useMemo(() => collectionDefs
    .map((c, i) => ({ ...c, count: recipes.filter((r) => r.collectionId === c.id).length, glyph: COLLECTION_GLYPHS[i % COLLECTION_GLYPHS.length], bg: COLLECTION_PALETTE[i % COLLECTION_PALETTE.length] }))
    .filter((c) => c.count > 0), [collectionDefs, recipes]);
  const activeCollectionName = collectionFilter ? collections.find((c) => c.id === collectionFilter)?.name ?? collectionDefs.find((c) => c.id === collectionFilter)?.name : null;

  function go(next: Screen) { guardNavigate(() => { setStatus(null); setScreen(next); }); }
  function openRecipe(id: string) { setActiveId(id); setServings(1); setChefReply(''); setChefQuestion(''); go('detail'); }
  function openCollection(id: string) { setCollectionFilter(id); setQuery(''); go('search'); }
  function pickFilter(f: string) { setCollectionFilter(null); setFilter(f); }
  function startCook() { setCookStep(0); go('cook'); }
  function finishOnboarding() {
    try { window.localStorage.setItem('omnicook_onboarded', '1'); }
    catch { /* Onboarding is optional even if browser storage is unavailable. */ }
    go('vault');
  }

  function runExtract() {
    if (!source.trim() || importing) return;
    const attemptedSource = source.trim();
    setFailedImport(null);
    setReportNote('');
    if (extractTimer.current) clearInterval(extractTimer.current);
    setImporting(true);
    setExtractIdx(0);
    setExtractSeconds(null);
    const started = Date.now();
    go('extracting');
    extractTimer.current = setInterval(() => {
      setExtractIdx((i) => (i < EXTRACT_STEPS.length - 1 ? i + 1 : i));
    }, 650);

    fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: attemptedSource }),
    })
      .then((res) => res.json())
      .then((data: { ok: boolean; message?: string; draft?: RecipeDraft; sourceUrl?: string | null; imageUrl?: string | null }) => {
        if (extractTimer.current) clearInterval(extractTimer.current);
        setExtractIdx(EXTRACT_STEPS.length - 1);
        if (data.ok && data.draft) {
          setExtractSeconds(Math.max(1, Math.round((Date.now() - started) / 1000)));
          setReviewDraft({ draft: data.draft, sourceUrl: data.sourceUrl ?? null, imageUrl: data.imageUrl ?? null });
          setEditRecipeId(null);
          setSelectedCollectionId(null);
          go('review');
        } else {
          go('import');
          const message = data.message ?? 'Import could not be completed.';
          setStatus(message);
          setFailedImport(failedLinkReport(attemptedSource, message));
        }
      })
      .catch(() => {
        if (extractTimer.current) clearInterval(extractTimer.current);
        go('import');
        const message = 'Import failed. Check your connection and try again.';
        setStatus(message);
        setFailedImport(failedLinkReport(attemptedSource, message));
      })
      .finally(() => setImporting(false));
  }

  function writeItMyself() {
    setReviewDraft({ draft: blankDraft(), sourceUrl: null, imageUrl: null });
    setExtractSeconds(null);
    setSelectedCollectionId(null);
    setNewCollectionName('');
    go('review');
  }

  function discardReview() {
    const wasEditing = editRecipeId != null;
    setReviewDraft(null);
    setEditRecipeId(null);
    setSelectedCollectionId(null);
    setNewCollectionName('');
    go(wasEditing ? 'detail' : 'import');
  }

  function openEditRecipe() {
    if (!signedIn || !activeId) return;
    const recipe = vaultRecipes.find((r) => r.id === activeId);
    if (!recipe) return;
    setReviewDraft({
      draft: {
        title: recipe.title,
        creator: recipe.creator,
        category: recipe.category as RecipeDraft['category'],
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        servings: recipe.servings,
        ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
        steps: recipe.steps.map((step) => ({ ...step })),
      },
      sourceUrl: recipe.sourceUrl,
      imageUrl: recipe.imageUrl,
    });
    setEditRecipeId(recipe.id);
    setSelectedCollectionId(recipe.collectionId);
    setExtractSeconds(null);
    go('edit');
  }

  async function deleteActiveRecipe() {
    if (!activeId) return;
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return;
    setDeletingRecipe(true);
    try {
      await deleteRecipe(activeId);
      setActiveId(null);
      await refreshVault();
      go('vault');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete this recipe.');
    } finally {
      setDeletingRecipe(false);
    }
  }

  async function saveReview() {
    if (!reviewDraft) return;
    if (!signedIn) { setStatus('Sign in to save recipes to your vault.'); return; }
    setSaving(true);
    try {
      if (editRecipeId) {
        await updateRecipe(editRecipeId, { draft: reviewDraft.draft, sourceUrl: reviewDraft.sourceUrl, collectionId: selectedCollectionId });
        await refreshVault();
        setReviewDraft(null);
        setEditRecipeId(null);
        setSelectedCollectionId(null);
        setNewCollectionName('');
        go('detail');
      } else {
        await createRecipeFromDraft(reviewDraft.draft, reviewDraft.sourceUrl, selectedCollectionId, reviewDraft.imageUrl);
        setReviewDraft(null);
        setSource('');
        setSelectedCollectionId(null);
        setNewCollectionName('');
        await refreshVault();
        go('vault');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this recipe.');
    } finally {
      setSaving(false);
    }
  }

  async function createCollectionInline() {
    const name = newCollectionName.trim();
    if (!name || creatingCollection) return;
    setCreatingCollection(true);
    try {
      const collection = await createCollection(name);
      setCollectionsState((prev) => [...prev, collection]);
      setSelectedCollectionId(collection.id);
      setNewCollectionName('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create the collection.');
    } finally {
      setCreatingCollection(false);
    }
  }

  function updateDraft<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setReviewDraft((cur) => cur && { ...cur, draft: { ...cur.draft, [key]: value } });
  }
  function updateIngredient(index: number, field: 'quantity' | 'unit' | 'name', value: string) {
    setReviewDraft((cur) => {
      if (!cur) return cur;
      const ingredients = cur.draft.ingredients.map((ing, i) => (i === index ? { ...ing, [field]: field === 'name' ? value : (value || null) } : ing));
      return { ...cur, draft: { ...cur.draft, ingredients } };
    });
  }
  function updateIngredientAisle(index: number, aisle: Aisle) {
    setReviewDraft((cur) => {
      if (!cur) return cur;
      const ingredients = cur.draft.ingredients.map((ing, i) => (i === index ? { ...ing, aisle } : ing));
      return { ...cur, draft: { ...cur.draft, ingredients } };
    });
  }
  function addIngredient() {
    setReviewDraft((cur) => {
      if (!cur) return cur;
      const ingredients = [...cur.draft.ingredients, { position: cur.draft.ingredients.length, quantity: null, unit: null, name: '', notes: null, aisle: 'Pantry' as Aisle }];
      return { ...cur, draft: { ...cur.draft, ingredients } };
    });
  }
  function removeIngredient(index: number) {
    setReviewDraft((cur) => {
      if (!cur || cur.draft.ingredients.length <= 1) return cur;
      const ingredients = cur.draft.ingredients.filter((_, i) => i !== index).map((ing, i) => ({ ...ing, position: i }));
      return { ...cur, draft: { ...cur.draft, ingredients } };
    });
  }
  function updateStep(index: number, value: string) {
    setReviewDraft((cur) => {
      if (!cur) return cur;
      const steps = cur.draft.steps.map((st, i) => (i === index ? { ...st, instruction: value } : st));
      return { ...cur, draft: { ...cur.draft, steps } };
    });
  }
  function addStep() {
    setReviewDraft((cur) => {
      if (!cur) return cur;
      const steps = [...cur.draft.steps, { position: cur.draft.steps.length, instruction: '' }];
      return { ...cur, draft: { ...cur.draft, steps } };
    });
  }
  function removeStep(index: number) {
    setReviewDraft((cur) => {
      if (!cur || cur.draft.steps.length <= 1) return cur;
      const steps = cur.draft.steps.filter((_, i) => i !== index).map((st, i) => ({ ...st, position: i }));
      return { ...cur, draft: { ...cur.draft, steps } };
    });
  }

  function cycleDay(day: string, iso: string) {
    if (recipes.length === 0) return;
    if (signedIn) {
      const currentId = mealPlan.find((mp) => mp.plannedFor === iso)?.recipeId;
      const idx = recipes.findIndex((r) => r.id === currentId);
      const next = recipes[(idx + 1) % recipes.length];
      upsertMealPlanItem(next.id, iso, 'dinner').then(refreshVault).catch((error) => setStatus(error instanceof Error ? error.message : 'Could not update the plan.'));
    } else {
      setDemoPlan((prev) => {
        const idx = recipes.findIndex((r) => r.id === prev[day]);
        const next = recipes[(idx + 1) % recipes.length];
        return { ...prev, [day]: next.id };
      });
    }
  }

  function toggleTick(name: string) { setTicked((prev) => ({ ...prev, [name]: !prev[name] })); }

  function askChef() {
    if (!chefQuestion.trim() || chefLoading) return;
    setChefLoading(true);
    fetch('/api/sous-chef', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: chefQuestion,
        recipeTitle: active?.t,
        ingredients: active?.a.map((ingredient) => `${ingredient.amt} ${ingredient.name}`),
        steps: active?.m,
      }),
    })
      .then((res) => res.json())
      .then((data: { ok: boolean; answer?: string; message?: string }) => setChefReply(data.ok ? (data.answer ?? '') : (data.message ?? 'The sous-chef could not respond.')))
      .catch(() => setChefReply('The sous-chef could not respond right now.'))
      .finally(() => setChefLoading(false));
  }

  if (!bootChecked) return <div style={s(`min-height:100svh;min-height:100dvh;background:${PAPER}`)} />;

  const showTabs = (['vault', 'search', 'planner', 'grocery', 'profile'] as Screen[]).includes(screen);
  const showSidebar = !(['onboarding', 'cook'] as Screen[]).includes(screen);
  const featured = recipes.find(r => r.img) ?? recipes[0];
  const navigation: { label: string; icon: KitchenIconName; screen: Screen }[] = [
    { label: 'Cookbook', icon: 'book', screen: 'vault' },
    { label: 'Meal plan', icon: 'calendar', screen: 'planner' },
    { label: 'Shopping list', icon: 'basket', screen: 'grocery' },
  ];
  const navActive = (target: Screen) => target === screen || (target === 'vault' && ['detail', 'search', 'edit', 'review'].includes(screen));

  return <main className={`app-shell screen-${screen}`}>
    <InterstitialAd open={interstitialOpen} onClose={closeInterstitial} />
    {showSidebar && <aside className="kitchen-sidebar" aria-label="Cookbook sidebar">
      <button className="wordmark" onClick={() => { pickFilter('All recipes'); go('vault'); }} aria-label="Omnicook home"><span className="brand-symbol"><KitchenIcon name="book" size={24} /></span>omnicook<span className="brand-dot">.</span></button>
      <button className="primary-button sidebar-add" onClick={() => go('import')}><KitchenIcon name="plus" size={20} /> Add a recipe</button>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(item => <button key={item.screen} className={`sidebar-link ${navActive(item.screen) ? 'is-active' : ''}`} aria-current={navActive(item.screen) ? 'page' : undefined} onClick={() => { if(item.screen === 'vault') pickFilter('All recipes'); go(item.screen); }}><KitchenIcon name={item.icon} /><span>{item.label}</span>{item.screen === 'vault' && <span className="nav-count">{recipes.length}</span>}</button>)}
      </nav>
      {collections.length > 0 && <div className="sidebar-collections"><h2>Your collections</h2>{collections.map(c => <button key={c.id} className={`collection-link ${collectionFilter === c.id && screen === 'search' ? 'is-active' : ''}`} onClick={() => openCollection(c.id)}><span className="collection-dot" style={{background:c.bg}} />{c.name}<span>{c.count}</span></button>)}</div>}
      <div className="sidebar-note"><KitchenIcon name="leaf" size={28} /><p>A place for every<br />recipe worth keeping.</p></div>
      <button className={`sidebar-profile ${screen === 'profile' ? 'is-active' : ''}`} onClick={() => go('profile')}><span className="avatar"><KitchenIcon name="user" size={18} /></span><span><b>My kitchen</b><small>{signedIn ? 'Account & collections' : 'Explore Omnicook'}</small></span><KitchenIcon name="chevron" size={15} /></button>
    </aside>}
    <div className="app-content">
    {screen === 'onboarding' && <div style={s(`flex:1;display:flex;flex-direction:column;padding:${TOP_SAFE} 26px calc(env(safe-area-inset-bottom,0px) + 32px);box-sizing:border-box;background:${GREEN};color:#ffffff`)}>
      <div style={s("font-family:'Lora',serif;font-weight:700;font-size:30px")}>omni<i style={s(`color:${LIME}`)}>cook</i></div>
      <div style={s('flex:1;display:flex;flex-direction:column;justify-content:center;gap:26px')}>
        <div style={s("font-family:'Lora',serif;font-weight:700;font-size:38px;line-height:1.08")}>Every recipe you saved, in one place.</div>
        <div style={s('font-size:15px;line-height:1.55;color:#d5e3d1;max-width:290px')}>Share a post from Instagram, TikTok or YouTube. Omnicook reads it and files a tidy recipe card in your vault.</div>
        <div style={s('display:flex;flex-direction:column;gap:10px;margin-top:6px')}>
          {[['◉', 'Paste a link, or share it in', 'Works from any social app'], ['✦', 'AI pulls out the recipe', 'Ingredients, steps, timings'], ['◈', 'Search it forever', 'By creator, ingredient or mood']].map(([glyph, title, sub]) => (
            <div key={title} style={s('display:flex;align-items:center;gap:13px;padding:14px 15px;border-radius:14px;background:#ffffff14;border:1px solid #ffffff2b')}>
              <span style={s(`display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:${LIME};color:${GREEN};font-size:15px;font-weight:700`)}>{glyph}</span>
              <div style={s('display:flex;flex-direction:column;gap:2px')}><b style={s('font-size:13.5px')}>{title}</b><span style={s('font-size:12px;color:#c9dcc5')}>{sub}</span></div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={finishOnboarding} style={s(`width:100%;padding:17px;border:0;border-radius:15px;background:${LIME};color:${INK};font-weight:700;font-size:15.5px`)}>Get started</button>
      <a href="/login" style={s('margin-top:6px;width:100%;padding:12px;border:0;background:transparent;color:#c9dcc5;font-size:13px;font-weight:600;text-align:center;text-decoration:none;box-sizing:border-box;display:block')}>I already have an account</a>
    </div>}

    {screen === 'vault' && <div className="vault-screen app-scroll">
      <header className="cookbook-header">
        <div><div className="mobile-brand"><KitchenIcon name="book" size={20} /> omnicook<span>.</span></div><h1>Your cookbook</h1><p>{loadingVault ? 'Gathering your recipes…' : `${recipes.length} recipes, ready when you are.`}</p></div>
        <button className="avatar mobile-account" aria-label="My kitchen" onClick={() => go('profile')}><KitchenIcon name="user" size={21} /></button>
        <button className="outline-button header-add" onClick={() => go('import')}><KitchenIcon name="plus" size={18} /> Add a recipe</button>
      </header>
      <button className="cookbook-search" onClick={() => go('search')}><KitchenIcon name="search" size={21} /><span>Find a recipe, ingredient or creator</span><span className="search-hint">Search your cookbook</span></button>
      {status && <p className="inline-status" role="status">{status}</p>}
      {!signedIn && configured && <p className="preview-notice">You’re exploring the preview. <a href="/login">Sign in for your own cookbook</a></p>}
      {featured && !loadingVault && filter === 'All recipes' && !collectionFilter && <section className="recipe-feature" aria-label="Recipe inspiration">
        <div className="feature-copy"><span className="feature-label"><KitchenIcon name="spark" size={16} /> A little inspiration</span><h2>{featured.t}</h2><p><KitchenIcon name="clock" size={15} />{featured.time}<span className="feature-divider" />{featured.a.length} ingredients</p><button className="feature-button" onClick={() => openRecipe(featured.id)}>Let’s make this<KitchenIcon name="arrow" size={18} /></button></div>
        <button className="feature-photo" onClick={() => openRecipe(featured.id)} aria-label={`Open ${featured.t}`}><RecipeImage src={featured.img ?? undefined} alt={featured.t} /><span>{featured.k}</span></button>
      </section>}
      {collections.length > 0 && <div className="collection-strip" aria-label="Recipe collections">{collections.map(c => <button key={c.id} onClick={() => openCollection(c.id)}><KitchenIcon name="book" size={17} /><b>{c.name}</b><span>{c.count}</span></button>)}</div>}
      <section className="recipe-library" aria-label="Saved recipes">
        <div className="library-heading"><div><h2>{filter === 'All recipes' && !collectionFilter ? 'All recipes' : activeCollectionName ?? filter}</h2><span>{filteredVault.length} {filteredVault.length === 1 ? 'recipe' : 'recipes'}</span></div><div className="layout-switch" aria-label="Recipe layout">{(['grid', 'feed', 'editorial'] as const).map(k => <button key={k} aria-label={`${k} view`} aria-pressed={layout === k} onClick={() => setLayout(k)}><KitchenIcon name={k === 'grid' ? 'grid' : k === 'feed' ? 'list' : 'book'} size={18} /></button>)}</div></div>
        <div className="recipe-filters" aria-label="Filter recipes">{GROUPS.map(g => <button key={g} aria-pressed={!collectionFilter && filter === g} onClick={() => pickFilter(g)}>{g}</button>)}</div>
        {!showVaultCards && <div className="cookbook-empty"><KitchenIcon name="book" size={36} /><h3>{vaultEmptyTitle}</h3><p>{vaultEmptyDetail}</p>{!loadingVault && <button className="primary-button" onClick={() => filter !== 'All recipes' ? pickFilter('All recipes') : go('import')}>{filter !== 'All recipes' ? 'Show all recipes' : 'Add a recipe'}</button>}</div>}
        {showVaultCards && <div className={`recipe-gallery layout-${layout}`}>{filteredVault.map((r, i) => <button key={r.id} className={`recipe-tile ${layout === 'editorial' && i === 0 ? 'tile-featured' : ''}`} onClick={() => openRecipe(r.id)}>
          <span className="tile-image"><RecipeImage src={r.img ?? undefined} alt={r.t} loading="lazy" /><span className="tile-source">{r.s}</span></span>
          <span className="tile-copy"><span className="tile-category">{r.k}</span><strong>{r.t}</strong><span className="tile-meta"><KitchenIcon name="clock" size={14} />{r.time}<span className="meta-dot" />{r.n} {r.n === 1 ? 'serving' : 'servings'}</span></span>
          {layout === 'feed' && <KitchenIcon name="chevron" size={20} />}
        </button>)}</div>}
      </section>
      <div className="cookbook-footer"><KitchenIcon name="leaf" size={18} /><span>Good recipes deserve to be made again.</span></div>
    </div>}

    {screen === 'search' && <div className="utility-screen search-screen" style={s(`flex:1;${SCROLL};padding:${TOP_SAFE} 0 ${BOTTOM_SAFE}`)}>
      <div style={s('display:flex;align-items:center;gap:11px;padding:0 18px')}>
        <button onClick={() => { setCollectionFilter(null); go('vault'); }} style={s(`width:44px;height:44px;border:1px solid ${LINE};border-radius:50%;background:${CARD};font-size:17px;flex:none`)}>‹</button>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, creators, ingredients…" style={s(`flex:1;min-width:0;padding:13px 14px;border:1px solid ${GREEN};border-radius:14px;background:${CARD};font-size:16px;box-sizing:border-box`)} />
      </div>
      {collectionFilter ? <div style={s('padding:16px 18px 0')}>
        <button onClick={() => setCollectionFilter(null)} style={s(`display:inline-flex;align-items:center;gap:8px;border:1px solid ${GREEN};border-radius:20px;padding:8px 13px;background:${GREEN};color:#fff;font-size:12px;font-weight:700`)}>{activeCollectionName ?? 'Collection'} ×</button>
      </div> : <div style={s('display:flex;gap:8px;flex-wrap:wrap;padding:16px 18px 0')}>
        {FILTERS.map((f) => { const p = pill(filter === f); return <button key={f} onClick={() => pickFilter(f)} style={s(`border:1px solid ${LINE};border-radius:20px;padding:8px 13px;background:${p.bg};color:${p.fg};font-size:12px;font-weight:700`)}>{f}</button>; })}
      </div>}
      <div style={s('padding:22px 18px 10px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#647187')}>{filteredSearch.length} recipes</div>
      <div style={s('display:flex;flex-direction:column;gap:11px;padding:0 18px')}>
        {filteredSearch.map((r) => <button key={r.id} onClick={() => openRecipe(r.id)} style={s(`display:flex;align-items:center;gap:13px;width:100%;padding:10px;border:1px solid ${LINE};border-radius:15px;background:${CARD};text-align:left`)}>
          {r.img && <RecipeImage src={r.img} alt={r.t} style={s('width:58px;height:58px;border-radius:11px;object-fit:cover;flex:none')} />}
          <span style={s('display:flex;flex-direction:column;gap:4px;min-width:0')}>
            <b style={s('font-size:14px;line-height:1.25')}>{r.t}</b>
            <span style={s(`font-size:11.5px;color:${MUTED}`)}>{r.c} · {r.s} · ◷ {r.time}</span>
          </span>
        </button>)}
      </div>
    </div>}

    {screen === 'import' && <div className="utility-screen import-screen app-scroll">
      <button className="back-button" onClick={() => go('vault')}><KitchenIcon name="arrow" style={{transform:'rotate(180deg)'}} size={18} /> Cookbook</button>
      <header className="utility-heading"><h1>Keep something delicious.</h1><p>That recipe you don’t want to lose? Give it a home.</p></header>
      <section className="import-panel"><span className="import-symbol"><KitchenIcon name="book" size={30} /></span><h2>From their kitchen to yours</h2><p>Copy a link from a food blog or social post, or paste the full recipe caption.</p><label htmlFor="recipe-source">Recipe link or caption</label><textarea id="recipe-source" value={source} onChange={e => setSource(e.target.value)} placeholder="Paste your link or recipe here…" rows={5} /><button className="primary-button" onClick={runExtract} disabled={importing || !source.trim()}><KitchenIcon name="spark" size={18} />{importing ? 'Reading your recipe…' : 'Import recipe'}<KitchenIcon name="arrow" size={18} /></button><p className="import-support">Instagram, Pinterest, YouTube, TikTok & food blogs</p>{status && <p className="inline-status" role="status">{status}</p>}</section>
      {failedImport && reportEmail && <section className="import-panel import-report" aria-labelledby="report-heading">
        <h2 id="report-heading">Help us support this recipe</h2>
        <p>Report the failed link so we can review it and improve imports.</p>
        <a className="report-source" href={failedImport.source} target="_blank" rel="noreferrer">{failedImport.source}</a>
        <label htmlFor="import-report-note">Anything else? (optional)</label>
        <textarea id="import-report-note" value={reportNote} onChange={e => setReportNote(e.target.value)} maxLength={1000} rows={3} placeholder="Tell us what went wrong…" />
        <a className="primary-button" href={reportEmail}>Report this link by email <KitchenIcon name="arrow" size={18} /></a>
        <p className="import-support">Opens your email app with the link and error included. Review the email and tap Send.</p>
      </section>}
      <button className="manual-recipe" onClick={writeItMyself}><span className="avatar"><KitchenIcon name="plus" size={22} /></span><span><b>Write a recipe of your own</b><small>Family favourites, experiments, happy accidents.</small></span><KitchenIcon name="chevron" size={18} /></button>
      <p className="import-footnote">You’ll review the ingredients and method before saving.</p>
    </div>}

    {screen === 'extracting' && <div style={s(`flex:1;display:flex;flex-direction:column;padding:${TOP_SAFE} 24px calc(env(safe-area-inset-bottom,0px) + 30px);box-sizing:border-box;background:${GREEN};color:#ffffff`)}>
      <div style={s('display:flex;align-items:center;gap:10px')}>
        <span style={s(`display:inline-block;width:15px;height:15px;border:2px solid #ffffff40;border-top-color:${LIME};border-radius:50%;animation:omspin .8s linear infinite`)} />
        <span style={s(`font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${LIME}`)}>Extracting</span>
      </div>
      <div style={s("font-family:'Lora',serif;font-weight:700;font-size:28px;line-height:1.15;margin:14px 0 30px")}>Reading your recipe…</div>
      <div style={s('display:flex;flex-direction:column;gap:3px')}>
        {EXTRACT_STEPS.map((label, i) => {
          const done = i < extractIdx, now = i === extractIdx;
          const bg = done ? LIME : now ? '#ffffff2e' : '#ffffff14';
          const fg = done ? GREEN : '#ffffff';
          const text = done || now ? '#ffffff' : '#8fab8a';
          return <div key={label} style={s('display:flex;align-items:center;gap:12px;padding:12px 2px')}>
            <span style={s(`display:grid;place-items:center;width:26px;height:26px;border-radius:50%;flex:none;font-size:12px;font-weight:700;background:${bg};color:${fg}`)}>{done ? '✓' : i + 1}</span>
            <span style={s(`font-size:14px;font-weight:600;color:${text}`)}>{label}</span>
          </div>;
        })}
      </div>
      <div style={s('flex:1')} />
      <div style={s('height:4px;border-radius:99px;background:#ffffff26;overflow:hidden')}><div style={s(`height:100%;background:${LIME};border-radius:99px;transition:width .5s ease;width:${Math.round((extractIdx / (EXTRACT_STEPS.length - 1)) * 100)}%`)} /></div>
      <button onClick={() => go('vault')} style={s('margin-top:16px;width:100%;padding:13px;border:1px solid #ffffff3d;border-radius:14px;background:transparent;color:#d5e3d1;font-size:13px;font-weight:600')}>Keep browsing while this finishes</button>
    </div>}

    {(screen === 'review' || screen === 'edit') && reviewDraft && <div className="recipe-editor" style={s('flex:1;display:flex;flex-direction:column;min-height:0')}>
      <div style={s(`flex:1;${SCROLL};padding:${TOP_SAFE} 0 24px`)}>
        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 20px')}>
          <button onClick={discardReview} style={s(`width:44px;height:44px;border:1px solid ${LINE};border-radius:50%;background:${CARD};font-size:17px`)}>‹</button>
          {extractSeconds != null && <span style={s(`display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:20px;background:${LIME};font-size:11.5px;font-weight:700`)}>✦ Extracted in {extractSeconds}s</span>}
        </div>
        <div style={s('padding:16px 20px 0')}>
          <div style={s('font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#647187')}>{editRecipeId ? 'Edit recipe' : 'Check before saving'}</div>
          <RecipeImage src={reviewDraft.imageUrl ?? undefined} alt={reviewDraft.draft.title} style={s('width:100%;height:180px;object-fit:cover;border-radius:14px;margin:12px 0')} />
          <input value={reviewDraft.draft.title} onChange={(e) => updateDraft('title', e.target.value)} placeholder="Recipe title" style={s("width:100%;margin-top:6px;padding:0;border:0;outline:0;background:transparent;font-family:'Lora',serif;font-weight:700;font-size:27px;line-height:1.15;box-sizing:border-box")} />
          <div style={s('display:flex;gap:8px;flex-wrap:wrap;margin-top:12px')}>
            {(['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other'] as const).map((cat) => { const on = reviewDraft.draft.category === cat; return <button key={cat} onClick={() => updateDraft('category', cat)} style={s(`padding:7px 11px;border:1px solid ${on ? GREEN : LINE};border-radius:20px;background:${on ? GREEN : CARD};color:${on ? '#fff' : INK};font-size:11.5px;font-weight:600`)}>{cat}</button>; })}
          </div>
          <label style={s('display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:#647187')}>Servings
            <input type="number" min={1} value={reviewDraft.draft.servings ?? ''} onChange={(e) => updateDraft('servings', e.target.value ? Number(e.target.value) : null)} style={s(`width:72px;padding:9px 10px;border:1px solid ${LINE};border-radius:8px;background:${CARD};font-size:16px`)} />
          </label>
        </div>
        <div style={s(`margin:20px 20px 0;padding:14px 15px;border:1px solid ${LINE};border-radius:16px;background:${CARD}`)}>
          <div style={s('display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px')}>
            <b style={s("font-family:'Lora',serif;font-size:16px")}>Ingredients</b>
            <span style={s(`font-size:11px;color:${MUTED}`)}>{reviewDraft.draft.ingredients.length} found</span>
          </div>
          {reviewDraft.draft.ingredients.map((ingredient, index) => <div key={index} style={s(`padding:9px 0;border-bottom:1px solid ${LINE}`)}>
            <div style={s('display:flex;align-items:center;gap:8px')}>
              <input aria-label="Quantity" value={ingredient.quantity ?? ''} onChange={(e) => updateIngredient(index, 'quantity', e.target.value)} placeholder="qty" style={s(`width:58px;padding:9px 7px;border:1px solid ${LINE};border-radius:7px;font-size:16px`)} />
              <input aria-label="Unit" value={ingredient.unit ?? ''} onChange={(e) => updateIngredient(index, 'unit', e.target.value)} placeholder="unit" style={s(`width:62px;padding:9px 7px;border:1px solid ${LINE};border-radius:7px;font-size:16px`)} />
              <input aria-label="Ingredient" value={ingredient.name} onChange={(e) => updateIngredient(index, 'name', e.target.value)} placeholder="ingredient" style={s(`flex:1;padding:9px 8px;border:1px solid ${LINE};border-radius:7px;font-size:16px;min-width:0`)} />
              <button onClick={() => removeIngredient(index)} aria-label="Remove" style={s(`width:44px;height:44px;border:0;background:transparent;color:${MUTED};font-size:18px;flex:none`)}>×</button>
            </div>
            <div style={s('display:flex;gap:6px;margin-top:6px')}>
              {AISLES.map((aisle) => { const on = ingredient.aisle === aisle; return <button key={aisle} onClick={() => updateIngredientAisle(index, aisle)} style={s(`padding:4px 9px;border:1px solid ${on ? GREEN : LINE};border-radius:20px;background:${on ? GREEN : 'transparent'};color:${on ? '#fff' : MUTED};font-size:10.5px;font-weight:600`)}>{AISLE_SHORT[aisle]}</button>; })}
            </div>
          </div>)}
          <button onClick={addIngredient} style={s(`margin-top:10px;border:0;background:transparent;color:${GREEN};font-size:12.5px;font-weight:700`)}>+ Add an ingredient</button>
        </div>
        <div style={s(`margin:14px 20px 0;padding:14px 15px;border:1px solid ${LINE};border-radius:16px;background:${CARD}`)}>
          <b style={s("font-family:'Lora',serif;font-size:16px")}>Method</b>
          {reviewDraft.draft.steps.map((step, index) => <div key={index} style={s('display:flex;gap:9px;align-items:flex-start;padding:8px 0')}>
            <b style={s(`color:${MUTED};font-size:13px;margin-top:9px`)}>{index + 1}.</b>
            <textarea value={step.instruction} onChange={(e) => updateStep(index, e.target.value)} style={s(`flex:1;padding:10px;border:1px solid ${LINE};border-radius:8px;font-size:16px;line-height:1.45;min-height:52px;font-family:inherit;box-sizing:border-box`)} />
            <button onClick={() => removeStep(index)} aria-label="Remove" style={s(`width:44px;height:44px;border:0;background:transparent;color:${MUTED};font-size:18px;margin-top:5px;flex:none`)}>×</button>
          </div>)}
          <button onClick={addStep} style={s(`margin-top:6px;border:0;background:transparent;color:${GREEN};font-size:12.5px;font-weight:700`)}>+ Add a step</button>
        </div>
        {signedIn && <div style={s('margin:14px 20px 0;padding:14px 15px;border-radius:16px;background:#edf1fb')}>
          <b style={s('font-size:12.5px')}>Save to a collection</b>
          <div style={s('display:flex;gap:8px;flex-wrap:wrap;margin-top:10px')}>
            {collectionsState.map((c) => { const on = selectedCollectionId === c.id; return <button key={c.id} onClick={() => setSelectedCollectionId(on ? null : c.id)} style={s(`padding:8px 12px;border-radius:20px;background:${on ? GREEN : 'transparent'};border:1px solid ${on ? GREEN : '#cfd8c8'};color:${on ? '#fff' : '#3f5240'};font-size:11.5px;font-weight:700`)}>{c.name}{on ? ' ✓' : ''}</button>; })}
          </div>
          <div style={s('display:flex;gap:8px;margin-top:10px')}>
            <input value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createCollectionInline()} placeholder="New collection name" style={s(`flex:1;min-width:0;padding:10px 11px;border:1px solid #cfd8c8;border-radius:10px;font-size:16px;background:#fff`)} />
            <button onClick={createCollectionInline} disabled={creatingCollection || !newCollectionName.trim()} style={s(`padding:0 14px;border:0;border-radius:10px;background:${GREEN};color:#fff;font-size:12px;font-weight:700`)}>{creatingCollection ? '…' : '+ New'}</button>
          </div>
        </div>}
        {status && <p style={s(`margin:14px 20px 0;font-size:12.5px;color:${MUTED}`)}>{status}</p>}
      </div>
      <div style={s(`padding:12px 20px calc(env(safe-area-inset-bottom,0px) + 18px);border-top:1px solid ${LINE};background:${PAPER};display:flex;gap:10px`)}>
        <button onClick={discardReview} style={s(`padding:15px 16px;border:1px solid ${LINE};border-radius:14px;background:${CARD};font-size:14px;font-weight:700`)}>Discard</button>
        <button onClick={saveReview} disabled={!signedIn || saving} style={s(`flex:1;padding:15px;border:0;border-radius:14px;background:${GREEN};color:#fff;font-size:14.5px;font-weight:700;opacity:${!signedIn || saving ? 0.6 : 1}`)}>{saving ? 'Saving…' : !signedIn ? 'Sign in to save' : editRecipeId ? 'Save changes' : 'Save to vault'}</button>
      </div>
    </div>}

    {screen === 'detail' && active && <div className="recipe-detail" style={s('flex:1;display:flex;flex-direction:column;min-height:0')}>
      <div className="detail-scroll" style={s(`flex:1;${SCROLL}`)}>
        <div className="detail-hero"><RecipeImage src={active.img ?? undefined} alt={active.t} /><div className="detail-toolbar"><button className="round-button" onClick={() => go('vault')} aria-label="Back to cookbook"><KitchenIcon name="arrow" style={{transform:'rotate(180deg)'}} /></button>{signedIn && <div><button className="round-button" onClick={openEditRecipe} aria-label="Edit recipe"><KitchenIcon name="edit" size={19} /></button><button className="round-button" onClick={deleteActiveRecipe} disabled={deletingRecipe} aria-label="Delete recipe"><KitchenIcon name="trash" size={19} /></button></div>}</div></div>
        <header className="recipe-heading"><span className="recipe-origin">{active.k} <span>from {active.s}</span></span><h1>{active.t}</h1><p><KitchenIcon name="clock" size={17} />{active.time}<span className="meta-dot" />Serves {active.n * servings}<span className="meta-dot" />{active.a.length} ingredients</p></header>
        {signedIn && <div style={s('padding:12px 20px 0;display:flex;flex-direction:column;gap:8px')}>
          {active.photoMetadata?.kind === 'generated' && <span style={s(`font-size:11px;color:${MUTED}`)}>AI illustration</span>}
          {active.photoMetadata?.kind === 'lookup' && <span style={s(`font-size:11px;color:${MUTED}`)}>
            Related photo: <a href={active.photoMetadata.creditUrl} target="_blank" rel="noreferrer">{active.photoMetadata.credit}</a>
            {' · '}<a href={active.photoMetadata.licenseUrl} target="_blank" rel="noreferrer">{active.photoMetadata.license}</a> (resized)
          </span>}
          <label className="photo-upload" style={s(`align-self:flex-start;padding:10px 13px;border:1px solid ${LINE};border-radius:12px;background:${CARD};color:${GREEN};font-size:12px;font-weight:600;cursor:pointer;opacity:${uploadingPhoto ? 0.6 : 1}`)}>
            {uploadingPhoto ? 'Saving photo…' : active.photoMetadata?.kind === 'user' ? 'Replace my cooking photo' : 'Add my cooking photo'}
            <input type="file" accept="image/*" aria-label="Add my cooking photo" disabled={uploadingPhoto} className="visually-hidden" onChange={event => {
              const file=event.currentTarget.files?.[0];
              event.currentTarget.value='';
              if(file) addCookingPhoto(file,active.id);
            }} />
          </label>
          {photoStatus && <span role="status" style={s(`font-size:12px;color:${MUTED}`)}>{photoStatus}</span>}
        </div>}
        {active.sourceUrl && <div style={s('padding:16px 20px 0')}>
          <a href={active.sourceUrl} target="_blank" rel="noreferrer" style={s(`display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid ${LINE};border-radius:14px;background:${CARD};text-decoration:none;color:${INK}`)}>
            <span style={s('display:flex;flex-direction:column;gap:2px')}><b style={s('font-size:12.5px')}>{active.c}</b><span style={s(`font-size:11px;color:${MUTED}`)}>View the original post</span></span>
            <span style={s(`font-size:13px;color:${GREEN}`)}>↗</span>
          </a>
        </div>}
        <div className="detail-ad">
          <BannerAd unit={GAM_BANNER_DETAIL_UNIT} sizes={[[320, 50]]} height={50} />
        </div>
        <div className="recipe-columns"><section className="ingredient-panel" style={s('padding:20px 20px 0')}>
          <div style={s('display:flex;align-items:center;justify-content:space-between')}>
            <h3 style={s("font-family:'Lora',serif;font-size:19px;margin:0")}>Ingredients</h3>
            <div style={s(`display:flex;gap:3px;padding:3px;border:1px solid ${LINE};border-radius:11px;background:${CARD}`)}>
              {[1, 2, 3].map((v) => { const sg = seg(servings === v); return <button key={v} aria-pressed={servings === v} aria-label={`${v} times the recipe`} onClick={() => setServings(v)} style={s(`padding:6px 11px;border:0;border-radius:8px;background:${sg.bg};color:${sg.fg};font-size:12px;font-weight:700`)}>{v}×</button>; })}
            </div>
          </div>
          <div style={s('margin-top:10px')}>
            {active.a.map((ingredient) => <div key={ingredient.name} style={s(`display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid ${LINE};font-size:13.5px`)}>
              <b style={s(`display:inline-block;width:62px;color:${CORAL};font-size:13px`)}>{scaleAmount(ingredient.amt, servings)}</b>
              <span>{ingredient.name}</span>
            </div>)}
          </div>
        </section>
        <section className="method-panel" style={s('padding:22px 20px 0')}>
          <h3 style={s("font-family:'Lora',serif;font-size:19px;margin:0 0 6px")}>Method</h3>
          {active.m.map((text, i) => <div key={i} style={s('display:flex;gap:11px;padding:10px 0;font-size:13.5px;line-height:1.5')}>
            <b style={s(`color:${MUTED}`)}>{i + 1}.</b><span>{text}</span>
          </div>)}
        </section></div>
        <div className="sous-chef-panel" style={s('margin:18px 20px 24px;padding:16px;border-radius:16px;background:#edf1fb')}>
          <b style={s('font-size:13px')}>✦ Ask your AI sous-chef</b>
          <div style={s('display:flex;gap:8px;margin-top:11px')}>
            <input value={chefQuestion} onChange={(e) => setChefQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askChef()} placeholder="What can I substitute for cream?" style={s('flex:1;min-width:0;padding:11px;border:0;border-radius:10px;background:#fff;font-size:16px;color:#647187')} />
            <button onClick={askChef} disabled={chefLoading} style={s(`padding:0 15px;border:0;border-radius:10px;background:${GREEN};color:#fff;font-size:13px;font-weight:700`)}>{chefLoading ? '…' : 'Ask'}</button>
          </div>
          {chefReply && <p style={s('font-size:12.5px;line-height:1.5;color:#405775;margin:11px 0 0')}>{chefReply}</p>}
        </div>
      </div>
        <div className="detail-actions" style={s('padding:8px 20px calc(env(safe-area-inset-bottom,0px) + 24px);display:flex;gap:10px')}>
          <button onClick={() => go('planner')} style={s(`padding:15px 16px;border:1px solid ${LINE};border-radius:14px;background:${CARD};font-size:14px;font-weight:700`)}>▦ Plan</button>
          <button onClick={startCook} style={s(`flex:1;padding:15px;border:0;border-radius:14px;background:${GREEN};color:#fff;font-size:14.5px;font-weight:700`)}>Start cooking</button>
        </div>
    </div>}

    {screen === 'cook' && active && <div className="cooking-screen" style={s('flex:1;display:flex;flex-direction:column;min-height:0;background:#ffffff')}>
      <div style={s('padding:calc(env(safe-area-inset-top,0px) + 20px) 22px 0')}>
        <div style={s('display:flex;align-items:center;justify-content:space-between')}>
          <button aria-label="Close cooking mode" onClick={() => go('detail')} style={s(`width:44px;height:44px;border:1px solid ${LINE};border-radius:50%;background:${PAPER};font-size:16px`)}>✕</button>
          <span style={s('padding:7px 12px;border-radius:20px;background:#edf1fb;color:#3158cf;font-size:11.5px;font-weight:700')}>Cooking mode</span>
        </div>
        <div style={s('display:flex;gap:5px;margin-top:20px')}>
          {active.m.map((_, i) => <div key={i} style={s(`flex:1;height:4px;border-radius:99px;background:${i <= cookStep ? GREEN : LINE}`)} />)}
        </div>
        <div style={s('margin-top:14px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#647187')}>Step {cookStep + 1} of {active.m.length} · {active.t}</div>
      </div>
      <div className="cooking-body" style={s(`flex:1;${SCROLL};padding:14px 22px 0`)}>
        <div style={s("font-family:'Lora',serif;font-weight:700;font-size:30px;line-height:1.2")}>{active.m[cookStep]}</div>
        <div className="cooking-ingredients" style={s(`margin-top:22px;padding:15px;border-radius:15px;background:${PAPER};border:1px solid ${LINE}`)}>
          <div style={s('font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#647187;margin-bottom:8px')}>Ingredients at hand</div>
          {active.a.map((ingredient) => <div key={ingredient.name} style={s('display:flex;gap:9px;padding:5px 0;font-size:13.5px')}><b style={s(`width:62px;color:${CORAL}`)}>{scaleAmount(ingredient.amt, servings)}</b><span>{ingredient.name}</span></div>)}
        </div>
        <div className="cooking-helper" style={s('display:flex;gap:10px;margin-top:14px')}>
          <input aria-label="Ask a cooking question" value={chefQuestion} onChange={e => setChefQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && askChef()} placeholder="Ask a cooking question…" />
          <button onClick={askChef} disabled={chefLoading} style={s(`flex:1;padding:13px;border:1px solid ${LINE};border-radius:14px;background:${PAPER};font-size:13px;font-weight:700`)}>{chefLoading ? 'Asking…' : '✦ Ask sous-chef'}</button>
        </div>
        {chefReply && <p style={s('margin:12px 0 0;padding:13px;border-radius:13px;background:#edf1fb;font-size:12.5px;line-height:1.5;color:#405775')}>{chefReply}</p>}
      </div>
      <div style={s('padding:12px 22px calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;gap:10px')}>
        <button aria-label="Previous step" disabled={cookStep === 0} onClick={() => setCookStep((v) => Math.max(0, v - 1))} style={s(`padding:16px 18px;border:1px solid ${LINE};border-radius:14px;background:${PAPER};font-size:14px;font-weight:700`)}>‹</button>
        <button onClick={() => (cookStep === active.m.length - 1 ? go('detail') : setCookStep((v) => v + 1))} style={s(`flex:1;padding:16px;border:0;border-radius:14px;background:${GREEN};color:#fff;font-size:14.5px;font-weight:700`)}>{cookStep === active.m.length - 1 ? 'Finish cooking' : 'Next step'}</button>
      </div>
    </div>}

    {screen === 'planner' && <div className="utility-screen planner-screen" style={s(`flex:1;${SCROLL};padding:${TOP_SAFE} 0 ${BOTTOM_SAFE}`)}>
      <header className="utility-heading planner-heading"><h1>Your weekly menu</h1><p>A little planning. More time around the table.</p></header>
      <div className="week-board">
        {weekDates.map((d, i) => { const rec = weekRecipes[i]; return <div key={d.iso} className="day-card">
          <span style={s(`width:34px;flex:none;font-size:11.5px;font-weight:700;color:${MUTED}`)}>{d.short}</span>
          {rec?.img && <RecipeImage src={rec.img} alt={rec.t} style={s('width:44px;height:44px;border-radius:10px;object-fit:cover;flex:none')} />}
          <span style={s(`flex:1;font-size:13.5px;font-weight:600;line-height:1.3;color:${rec ? INK : '#9aa398'}`)}>{rec ? rec.t : 'Nothing planned yet'}</span>
          <button aria-label={`${rec ? 'Change' : 'Add'} recipe for ${d.day}`} onClick={() => cycleDay(d.day, d.iso)} style={s('flex:none;border:0;border-radius:9px;padding:8px 11px;background:#edf1fb;color:#3158cf;font-size:11.5px;font-weight:700')}>{rec ? 'Change' : 'Add'}</button>
        </div>; })}
      </div>
      <button onClick={() => go('grocery')} style={s('display:flex;align-items:center;justify-content:space-between;width:calc(100% - 40px);margin:14px 20px 0;padding:17px;border:0;border-radius:17px;background:#f1f4dd;text-align:left')}>
        <span style={s('display:flex;flex-direction:column;gap:3px')}>
          <b style={s("font-family:'Lora',serif;font-size:17px")}>Shopping list</b>
          <span style={s(`font-size:12px;color:${MUTED}`)}>{groceryNames.length} items from {plannedCount} planned recipes</span>
        </span>
        <span style={s('font-size:15px;color:#8a6a1f')}>›</span>
      </button>
    </div>}

    {screen === 'grocery' && <div className="utility-screen grocery-screen" style={s(`flex:1;${SCROLL};padding:${TOP_SAFE} 0 ${BOTTOM_SAFE};background:${PAPER}`)}>
      <div style={s('display:flex;align-items:center;gap:11px;padding:0 20px')}>
        <button onClick={() => go('planner')} style={s(`width:44px;height:44px;border:1px solid ${LINE};border-radius:50%;background:${CARD};font-size:17px`)}>‹</button>
        <span style={s(`font-size:13px;font-weight:700;color:${MUTED}`)}>Back to plan</span>
      </div>
      <header className="utility-heading planner-heading"><h1>Your shopping list</h1><p>{groceryNames.length} ingredients from {plannedCount} planned recipes.</p></header>
      {grocerySections.length === 0 && <p style={s(`padding:16px 20px 0;font-size:12.5px;color:${MUTED}`)}>Plan a few dinners to build your list.</p>}
      {grocerySections.map(([name, items]) => <div key={name} style={s('margin:16px 20px 0;padding:16px;border-radius:17px;background:#eff3f8')}>
        <div style={s(`font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${CORAL};margin-bottom:6px`)}>{name}</div>
        {items.map((item) => { const on = !!ticked[item]; return <button key={item} aria-pressed={!!ticked[item]} onClick={() => toggleTick(item)} style={s('display:flex;align-items:center;gap:11px;width:100%;padding:9px 0;border:0;background:transparent;text-align:left')}>
          <span style={s(`display:grid;place-items:center;width:19px;height:19px;flex:none;border:1.5px solid #cfc7ae;border-radius:5px;font-size:11px;color:#fff;background:${on ? GREEN : 'transparent'}`)}>{on ? '✓' : ''}</span>
          <span style={s(`font-size:13.5px;color:${on ? '#9aa398' : INK};text-decoration:${on ? 'line-through' : 'none'}`)}>{item}</span>
        </button>; })}
      </div>)}
      <div style={s(`margin:16px 20px 0;font-size:12px;color:${MUTED}`)}>Tap an item to tick it off. Duplicates across recipes are merged automatically.</div>
    </div>}

    {screen === 'profile' && <div className="utility-screen profile-screen" style={s(`flex:1;${SCROLL};padding:${TOP_SAFE} 0 ${BOTTOM_SAFE}`)}>
      {!signedIn ? <div style={s('padding:20px')}>
        <div style={s("font-family:'Lora',serif;font-weight:700;font-size:24px")}>You&apos;re browsing a preview</div>
        <p style={s(`font-size:13px;line-height:1.6;color:${MUTED};margin-top:8px`)}>{configured ? 'Sign in to see your own stats, collections and settings.' : 'Sign-in isn’t configured for this deployment yet.'}</p>
        {configured && <a href="/login" style={s(`display:inline-block;margin-top:14px;padding:13px 20px;border-radius:14px;background:${GREEN};color:#fff;font-size:13.5px;font-weight:700;text-decoration:none`)}>Sign in</a>}
      </div> : <>
        <div style={s('display:flex;align-items:center;gap:14px;padding:0 20px')}>
          <span style={s(`display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:${CORAL};color:#fff;font-weight:700;font-size:19px`)}>{(user?.email ?? '?').slice(0, 2).toUpperCase()}</span>
          <span style={s('display:flex;flex-direction:column;gap:3px')}>
            <b style={s("font-family:'Lora',serif;font-size:21px")}>{user?.email}</b>
            <span style={s(`font-size:12px;color:${MUTED}`)}>{collections.length} collections</span>
          </span>
        </div>
        <div style={s('display:flex;gap:10px;padding:18px 20px 0')}>
          {[{ v: recipes.length, k: 'recipes saved' }, { v: collections.length, k: 'collections' }, { v: mealPlan.length, k: 'meals planned' }].map((stat) => <div key={stat.k} style={s(`flex:1;padding:14px 12px;border:1px solid ${LINE};border-radius:15px;background:${CARD}`)}>
            <div style={s("font-family:'Lora',serif;font-weight:700;font-size:24px")}>{stat.v}</div>
            <div style={s(`font-size:11px;color:${MUTED}`)}>{stat.k}</div>
          </div>)}
        </div>
        {collections.length > 0 && <>
          <div style={s("padding:26px 20px 10px;font-family:'Lora',serif;font-size:18px;font-weight:700")}>Collections</div>
          <div style={s(`display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;padding:0 20px`)}>
            {collections.map((c) => <button key={c.id} onClick={() => openCollection(c.id)} style={s(`display:flex;flex-direction:column;justify-content:space-between;gap:26px;padding:14px;border:1px solid ${LINE};border-radius:16px;background:${c.bg};text-align:left`)}>
              <span style={s('font-size:18px')}>{c.glyph}</span>
              <span style={s('display:flex;flex-direction:column;gap:2px')}><b style={s('font-size:14px')}>{c.name}</b><span style={s(`font-size:11.5px;color:${MUTED}`)}>{c.count} recipes</span></span>
            </button>)}
          </div>
        </>}
        <div style={s(`margin:22px 20px 0;border:1px solid ${LINE};border-radius:17px;background:${CARD};overflow:hidden`)}>
          {[{ glyph: '◉', label: 'Recipe storage', value: 'Private cookbook' }, { glyph: '✦', label: 'Cooking help', value: 'AI sous-chef' }, { glyph: '▣', label: 'Units', value: 'Metric' }, { glyph: '◌', label: 'Notifications', value: 'Coming soon' }].map((row) => <div key={row.label} style={s(`display:flex;align-items:center;justify-content:space-between;padding:15px;border-bottom:1px solid ${LINE};font-size:13.5px`)}>
            <span style={s('display:flex;align-items:center;gap:11px')}><span style={s(`color:${MUTED}`)}>{row.glyph}</span>{row.label}</span>
            <span style={s(`font-size:12px;color:${MUTED}`)}>{row.value}</span>
          </div>)}
        </div>
      </>}
    </div>}

    {showTabs && <div className="navigation-ad"><BannerAd unit={GAM_BANNER_TABBAR_UNIT} sizes={[[320, 50]]} height={50} /></div>}
    {showTabs && <nav className="bottom-navigation" aria-label="Main navigation">
      <button aria-current={screen === 'vault' || screen === 'search' ? 'page' : undefined} onClick={() => { pickFilter('All recipes'); go('vault'); }}><KitchenIcon name="book" /><span>Cookbook</span></button>
      <button aria-current={screen === 'planner' ? 'page' : undefined} onClick={() => go('planner')}><KitchenIcon name="calendar" /><span>Plan</span></button>
      <button className="nav-add" aria-label="Add a recipe" onClick={() => go('import')}><span><KitchenIcon name="plus" size={26} /></span><small>Add recipe</small></button>
      <button aria-current={screen === 'grocery' ? 'page' : undefined} onClick={() => go('grocery')}><KitchenIcon name="basket" /><span>Shop</span></button>
      <button aria-current={screen === 'profile' ? 'page' : undefined} onClick={() => go('profile')}><KitchenIcon name="user" /><span>My kitchen</span></button>
    </nav>}
    </div>
  </main>;
}
