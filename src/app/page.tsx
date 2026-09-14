'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { s } from '@/lib/mobile/style';
import {
  COLLECTION_GLYPHS, COLLECTION_PALETTE, DAYS, DEMO_COLLECTIONS, DEMO_RECIPES,
  EXTRACT_STEPS, FILTERS, GROUPS, matchesFilter, scaleAmount, type Aisle, type MobileRecipe,
} from '@/lib/mobile/demo-data';
import { vaultToMobile } from '@/lib/mobile/adapters';
import { AUTH_CONFIGURED, useSession } from '@/lib/auth/session';
import {
  createCollection, createRecipeFromDraft, deleteRecipe, listCollections, listMealPlanItems, listRecipes,
  updateRecipe, upsertMealPlanItem, type Collection, type MealPlanItem, type VaultRecipe,
} from '@/lib/api/client';
import type { RecipeDraft } from '@/lib/recipe-schema';

type Screen = 'onboarding' | 'vault' | 'search' | 'import' | 'extracting' | 'review' | 'edit' | 'detail' | 'cook' | 'planner' | 'grocery' | 'profile';
type Layout = 'grid' | 'feed' | 'editorial';
type EntryMode = 'share' | 'paste';

const INK = '#1c241d', GREEN = '#244f3c', LIME = '#d9f08b', CORAL = '#ec795c', PAPER = '#f8f6f0', CARD = '#fffdf8', LINE = '#e2e3d9', MUTED = '#6a7169';

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
  const [entryMode, setEntryMode] = useState<EntryMode>('paste');
  const [filter, setFilter] = useState('All recipes');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [cookStep, setCookStep] = useState(0);
  const [chefQuestion, setChefQuestion] = useState('');
  const [chefReply, setChefReply] = useState('');
  const [chefLoading, setChefLoading] = useState(false);
  const [source, setSource] = useState('');
  const [importing, setImporting] = useState(false);
  const [extractIdx, setExtractIdx] = useState(0);
  const [extractSeconds, setExtractSeconds] = useState<number | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{ draft: RecipeDraft; sourceUrl: string | null } | null>(null);
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
  const extractTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const seen = typeof window !== 'undefined' ? window.localStorage.getItem('omnicook_onboarded') : '1';
    if (!seen) setScreen('onboarding');
    setBootChecked(true);
  }, []);

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
  const filteredSearch = recipes.filter((r) =>
    (collectionFilter ? r.collectionId === collectionFilter : matchesFilter(r, filter))
    && JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  const collectionDefs = signedIn ? collectionsState : DEMO_COLLECTIONS;
  const collections = useMemo(() => collectionDefs
    .map((c, i) => ({ ...c, count: recipes.filter((r) => r.collectionId === c.id).length, glyph: COLLECTION_GLYPHS[i % COLLECTION_GLYPHS.length], bg: COLLECTION_PALETTE[i % COLLECTION_PALETTE.length] }))
    .filter((c) => c.count > 0), [collectionDefs, recipes]);
  const activeCollectionName = collectionFilter ? collections.find((c) => c.id === collectionFilter)?.name ?? collectionDefs.find((c) => c.id === collectionFilter)?.name : null;

  function go(next: Screen) { setStatus(null); setScreen(next); }
  function openRecipe(id: string) { setActiveId(id); setServings(1); setChefReply(''); setChefQuestion(''); go('detail'); }
  function openCollection(id: string) { setCollectionFilter(id); setQuery(''); go('search'); }
  function pickFilter(f: string) { setCollectionFilter(null); setFilter(f); }
  function startCook() { setCookStep(0); go('cook'); }
  function finishOnboarding() {
    if (typeof window !== 'undefined') window.localStorage.setItem('omnicook_onboarded', '1');
    go('vault');
  }

  function runExtract() {
    if (!source.trim() || importing) return;
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
      body: JSON.stringify({ source }),
    })
      .then((res) => res.json())
      .then((data: { ok: boolean; message?: string; draft?: RecipeDraft; sourceUrl?: string | null }) => {
        if (extractTimer.current) clearInterval(extractTimer.current);
        setExtractIdx(EXTRACT_STEPS.length - 1);
        if (data.ok && data.draft) {
          setExtractSeconds(Math.max(1, Math.round((Date.now() - started) / 1000)));
          setReviewDraft({ draft: data.draft, sourceUrl: data.sourceUrl ?? null });
          go('review');
        } else {
          setStatus(data.message ?? 'Import could not be completed.');
          go('import');
        }
      })
      .catch(() => {
        if (extractTimer.current) clearInterval(extractTimer.current);
        setStatus('Import failed. Check your connection and try again.');
        go('import');
      })
      .finally(() => setImporting(false));
  }

  function writeItMyself() {
    setReviewDraft({ draft: blankDraft(), sourceUrl: null });
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
        await createRecipeFromDraft(reviewDraft.draft, reviewDraft.sourceUrl, selectedCollectionId);
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

  if (!bootChecked) return <div style={s(`min-height:100dvh;background:${PAPER}`)} />;

  const showTabs = (['vault', 'planner', 'grocery', 'profile'] as Screen[]).includes(screen);

  return <main style={s(`min-height:100dvh;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;background:${PAPER};color:${INK};font-family:'DM Sans',system-ui,sans-serif;position:relative`)}>

    {screen === 'onboarding' && <div style={s(`flex:1;display:flex;flex-direction:column;padding:32px 26px 40px;box-sizing:border-box;background:${GREEN};color:#fffdf8`)}>
      <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:30px")}>omni<i style={s(`color:${LIME}`)}>cook</i></div>
      <div style={s('flex:1;display:flex;flex-direction:column;justify-content:center;gap:26px')}>
        <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:38px;line-height:1.08;letter-spacing:-1px")}>Every recipe you saved, in one place.</div>
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

    {screen === 'vault' && <div style={s('flex:1;overflow:auto;padding:20px 0 100px')}>
      <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 20px 2px')}>
        <span style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:21px")}>omni<i style={s(`color:${CORAL}`)}>cook</i></span>
        <button onClick={() => go('profile')} style={s(`display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;background:${CORAL};color:#fff;font-weight:700;font-size:13px`)}>{signedIn ? (user?.email ?? '?').slice(0, 2).toUpperCase() : '＋'}</button>
      </div>
      <div style={s('padding:14px 20px 0')}>
        <div style={s('font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6d806b')}>{signedIn ? 'Your personal cookbook' : configured ? 'Preview — sign in for your own vault' : 'Your personal cookbook'}</div>
        <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:31px;letter-spacing:-.8px;margin:5px 0 0")}>What are we cooking?</div>
        <button onClick={() => go('search')} style={s(`display:flex;align-items:center;gap:9px;width:100%;margin-top:16px;padding:14px 15px;border:1px solid ${LINE};border-radius:14px;background:${CARD};color:${MUTED};font-size:13.5px;text-align:left`)}>
          <span style={s('font-size:14px')}>◌</span>Search recipes, creators, ingredients…
        </button>
        {status && <p style={s(`margin-top:10px;font-size:12.5px;color:${MUTED}`)}>{status}</p>}
      </div>

      {collections.length > 0 && <>
        <div style={s('display:flex;align-items:baseline;justify-content:space-between;padding:26px 20px 10px')}>
          <h2 style={s("font-family:'Playfair Display',serif;font-size:18px;margin:0")}>Collections</h2>
        </div>
        <div style={s('display:flex;gap:11px;overflow:auto;padding:0 20px 4px')}>
          {collections.map((c) => <button key={c.id} onClick={() => openCollection(c.id)} style={s(`flex:none;width:132px;display:flex;flex-direction:column;justify-content:space-between;gap:24px;padding:13px;border:1px solid ${LINE};border-radius:15px;background:${c.bg};text-align:left`)}>
            <span style={s('font-size:17px')}>{c.glyph}</span>
            <span style={s('display:flex;flex-direction:column;gap:2px')}><b style={s('font-size:13.5px')}>{c.name}</b><span style={s(`font-size:11.5px;color:${MUTED}`)}>{c.count} recipes</span></span>
          </button>)}
        </div>
      </>}

      <div style={s('padding:24px 20px 0')}>
        <div style={s('display:flex;align-items:center;gap:7px;margin-bottom:9px')}>
          <span style={s(`color:${CORAL};font-size:12px`)}>✦</span>
          <span style={s('font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6d806b')}>Grouped for you</span>
        </div>
        <div style={s('display:flex;gap:8px;flex-wrap:wrap')}>
          {GROUPS.map((g) => { const p = pill(!collectionFilter && filter === g); return <button key={g} onClick={() => pickFilter(g)} style={s(`border:1px solid ${LINE};border-radius:20px;padding:8px 13px;background:${p.bg};color:${p.fg};font-size:12px;font-weight:700`)}>{g}</button>; })}
        </div>
      </div>

      <div style={s('display:flex;align-items:baseline;justify-content:space-between;padding:26px 20px 12px')}>
        <h2 style={s("font-family:'Playfair Display',serif;font-size:18px;margin:0")}>{filter === 'All recipes' && !collectionFilter ? (signedIn ? 'Your saved recipes' : 'Preview recipes') : filter}</h2>
        <div style={s(`display:flex;gap:4px;padding:3px;border:1px solid ${LINE};border-radius:10px;background:${CARD}`)}>
          {(['grid', 'feed', 'editorial'] as const).map((k) => { const glyph = k === 'grid' ? '▦' : k === 'feed' ? '▤' : '◈'; const sg = seg(layout === k); return <button key={k} title={k} onClick={() => setLayout(k)} style={s(`width:28px;height:24px;border:0;border-radius:7px;background:${sg.bg};color:${sg.fg};font-size:12px`)}>{glyph}</button>; })}
        </div>
      </div>

      {loadingVault && <p style={s(`padding:0 20px;font-size:12.5px;color:${MUTED}`)}>Loading your vault…</p>}

      {layout === 'grid' && <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:13px;padding:0 20px')}>
        {filteredVault.map((r) => <button key={r.id} onClick={() => openRecipe(r.id)} style={s(`display:flex;flex-direction:column;padding:0;border:1px solid ${LINE};border-radius:15px;background:${CARD};overflow:hidden;text-align:left`)}>
          <span style={s('position:relative;display:block;width:100%;height:104px')}>
            {r.img && <img src={r.img} alt="" style={s('width:100%;height:104px;object-fit:cover;display:block')} />}
            <span style={s('position:absolute;left:8px;top:8px;background:#fffdf8e8;padding:4px 8px;border-radius:20px;font-size:10px;font-weight:700')}>{r.s}</span>
          </span>
          <span style={s('display:flex;flex-direction:column;gap:5px;padding:11px 12px 13px')}>
            <span style={s(`font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${CORAL}`)}>{r.k}</span>
            <b style={s('font-size:13.5px;line-height:1.25')}>{r.t}</b>
            <span style={s(`font-size:11px;color:${MUTED}`)}>◷ {r.time}</span>
          </span>
        </button>)}
      </div>}

      {layout === 'feed' && <div style={s('display:flex;flex-direction:column;gap:16px;padding:0 20px')}>
        {filteredVault.map((r) => <button key={r.id} onClick={() => openRecipe(r.id)} style={s(`display:flex;flex-direction:column;padding:0;border:1px solid ${LINE};border-radius:18px;background:${CARD};overflow:hidden;text-align:left`)}>
          <span style={s('position:relative;display:block;width:100%')}>
            {r.img && <img src={r.img} alt="" style={s('width:100%;height:186px;object-fit:cover;display:block')} />}
            <span style={s('position:absolute;left:11px;top:11px;background:#fffdf8e8;padding:5px 10px;border-radius:20px;font-size:10.5px;font-weight:700')}>{r.s}</span>
          </span>
          <span style={s('display:flex;flex-direction:column;gap:7px;padding:14px 15px 16px')}>
            <b style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:19px;line-height:1.2")}>{r.t}</b>
            <span style={s(`display:flex;align-items:center;justify-content:space-between;font-size:12px;color:${MUTED}`)}><span>{r.c}</span><span>◷ {r.time} · serves {r.n}</span></span>
          </span>
        </button>)}
      </div>}

      {layout === 'editorial' && <div style={s('display:flex;flex-direction:column;gap:14px;padding:0 20px')}>
        {filteredVault[0] && <button onClick={() => openRecipe(filteredVault[0].id)} style={s('position:relative;display:block;width:100%;padding:0;border:0;border-radius:20px;overflow:hidden;text-align:left')}>
          {filteredVault[0].img && <img src={filteredVault[0].img} alt="" style={s('width:100%;height:260px;object-fit:cover;display:block')} />}
          <span style={s('position:absolute;inset:0;background:linear-gradient(to top,#0e1a12f2 4%,#0e1a1200 62%)')} />
          <span style={s('position:absolute;left:18px;right:18px;bottom:17px;display:flex;flex-direction:column;gap:7px;color:#fffdf8')}>
            <span style={s(`font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${LIME}`)}>Most cooked this month</span>
            <span style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;line-height:1.12")}>{filteredVault[0].t}</span>
            <span style={s('font-size:12px;color:#e4ece0')}>{filteredVault[0].c} · ◷ {filteredVault[0].time}</span>
          </span>
        </button>}
        {filteredVault.slice(1).map((r) => <button key={r.id} onClick={() => openRecipe(r.id)} style={s(`display:flex;align-items:center;gap:13px;width:100%;padding:10px;border:1px solid ${LINE};border-radius:15px;background:${CARD};text-align:left`)}>
          {r.img && <img src={r.img} alt="" style={s('width:62px;height:62px;border-radius:11px;object-fit:cover;flex:none')} />}
          <span style={s('display:flex;flex-direction:column;gap:4px;min-width:0')}>
            <span style={s(`font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${CORAL}`)}>{r.s}</span>
            <b style={s('font-size:14px;line-height:1.25')}>{r.t}</b>
            <span style={s(`font-size:11.5px;color:${MUTED}`)}>{r.c} · ◷ {r.time}</span>
          </span>
        </button>)}
      </div>}

      <div style={s(`margin:26px 20px 0;padding:15px;border-radius:15px;background:${LIME}`)}>
        <b style={s('display:block;font-size:13px')}>Kitchen tip</b>
        <span style={s('font-size:12px;line-height:1.5;color:#2c3a2c')}>Open any recipe for serving scaling, cook mode, and your AI sous-chef.</span>
      </div>
    </div>}

    {screen === 'search' && <div style={s('flex:1;overflow:auto;padding:20px 0 100px')}>
      <div style={s('display:flex;align-items:center;gap:11px;padding:0 18px')}>
        <button onClick={() => { setCollectionFilter(null); go('vault'); }} style={s(`width:36px;height:36px;border:1px solid ${LINE};border-radius:50%;background:${CARD};font-size:15px`)}>‹</button>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, creators, ingredients…" style={s(`flex:1;padding:13px 14px;border:1px solid ${GREEN};border-radius:14px;background:${CARD};font-size:13.5px;box-sizing:border-box`)} />
      </div>
      {collectionFilter ? <div style={s('padding:16px 18px 0')}>
        <button onClick={() => setCollectionFilter(null)} style={s(`display:inline-flex;align-items:center;gap:8px;border:1px solid ${GREEN};border-radius:20px;padding:8px 13px;background:${GREEN};color:#fff;font-size:12px;font-weight:700`)}>{activeCollectionName ?? 'Collection'} ×</button>
      </div> : <div style={s('display:flex;gap:8px;flex-wrap:wrap;padding:16px 18px 0')}>
        {FILTERS.map((f) => { const p = pill(filter === f); return <button key={f} onClick={() => pickFilter(f)} style={s(`border:1px solid ${LINE};border-radius:20px;padding:8px 13px;background:${p.bg};color:${p.fg};font-size:12px;font-weight:700`)}>{f}</button>; })}
      </div>}
      <div style={s('padding:22px 18px 10px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6d806b')}>{filteredSearch.length} recipes</div>
      <div style={s('display:flex;flex-direction:column;gap:11px;padding:0 18px')}>
        {filteredSearch.map((r) => <button key={r.id} onClick={() => openRecipe(r.id)} style={s(`display:flex;align-items:center;gap:13px;width:100%;padding:10px;border:1px solid ${LINE};border-radius:15px;background:${CARD};text-align:left`)}>
          {r.img && <img src={r.img} alt="" style={s('width:58px;height:58px;border-radius:11px;object-fit:cover;flex:none')} />}
          <span style={s('display:flex;flex-direction:column;gap:4px;min-width:0')}>
            <b style={s('font-size:14px;line-height:1.25')}>{r.t}</b>
            <span style={s(`font-size:11.5px;color:${MUTED}`)}>{r.c} · {r.s} · ◷ {r.time}</span>
          </span>
        </button>)}
      </div>
    </div>}

    {screen === 'import' && <div style={s('flex:1;overflow:auto;padding:20px 0 100px')}>
      <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 20px')}>
        <button onClick={() => go('vault')} style={s(`width:36px;height:36px;border:1px solid ${LINE};border-radius:50%;background:${CARD};font-size:15px`)}>‹</button>
        <div style={s(`display:flex;gap:3px;padding:3px;border:1px solid ${LINE};border-radius:11px;background:${CARD}`)}>
          <button onClick={() => setEntryMode('share')} style={s(`padding:7px 12px;border:0;border-radius:8px;background:${entryMode === 'share' ? GREEN : 'transparent'};color:${entryMode === 'share' ? '#fff' : MUTED};font-size:11.5px;font-weight:700`)}>Share sheet</button>
          <button onClick={() => setEntryMode('paste')} style={s(`padding:7px 12px;border:0;border-radius:8px;background:${entryMode === 'paste' ? GREEN : 'transparent'};color:${entryMode === 'paste' ? '#fff' : MUTED};font-size:11.5px;font-weight:700`)}>Paste</button>
        </div>
      </div>
      <div style={s('padding:16px 20px 0')}>
        <div style={s('font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6d806b')}>Add to your vault</div>
        <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:29px;letter-spacing:-.6px;margin:5px 0 0")}>Import something delicious.</div>
      </div>

      {entryMode === 'share' && <div style={s(`margin:20px 20px 0;padding:22px 18px;border-radius:20px;background:${GREEN};color:#fffdf8`)}>
        <h2 style={s("font-family:'Playfair Display',serif;font-size:20px;margin:0")}>Sharing from your phone isn&apos;t wired up yet</h2>
        <p style={s('font-size:12.5px;line-height:1.5;color:#d5e3d1;margin:9px 0 15px')}>For now, copy the link from Instagram, TikTok, YouTube or Pinterest and paste it instead — Omnicook reads the page and extracts the recipe.</p>
        <button onClick={() => setEntryMode('paste')} style={s(`width:100%;padding:15px;border:0;border-radius:15px;background:${LIME};color:${INK};font-weight:700;font-size:14.5px`)}>Switch to Paste</button>
      </div>}

      {entryMode === 'paste' && <div style={s(`margin:20px 20px 0;padding:22px 18px;border-radius:20px;background:${GREEN};color:#fffdf8`)}>
        <h2 style={s("font-family:'Playfair Display',serif;font-size:22px;margin:0")}>Paste a recipe link</h2>
        <p style={s('font-size:12.5px;line-height:1.5;color:#d5e3d1;margin:7px 0 15px')}>Turn a post, video, or food blog into a tidy recipe card in seconds.</p>
        <div style={s('display:flex;background:#fff;padding:5px;border-radius:12px')}>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://instagram.com/reel/…" style={s('flex:1;padding:11px;border:0;outline:0;font-size:12.5px;color:#1c241d;background:transparent')} />
          <button onClick={runExtract} disabled={importing} style={s(`border:0;border-radius:9px;padding:0 15px;background:${LIME};font-weight:700;font-size:13px`)}>{importing ? '…' : 'Extract'}</button>
        </div>
        <textarea value={source} onChange={(e) => setSource(e.target.value)} placeholder="Or paste a creator's caption…" style={s('margin-top:12px;width:100%;padding:12px;border:1px solid #ffffff55;border-radius:12px;background:#ffffff12;font-size:12px;color:#c9dcc5;height:72px;box-sizing:border-box;font-family:inherit')} />
        <div style={s('margin-top:13px;font-size:11.5px;color:#d5e3d1')}>◉ Instagram &nbsp; ♪ TikTok &nbsp; ▶ YouTube &nbsp; ◈ Pinterest &nbsp; ⌘ Food blogs</div>
        {status && <p style={s('margin-top:10px;font-size:12px;color:#f3d9cd')}>{status}</p>}
      </div>}

      <div style={s('display:flex;gap:11px;margin:14px 20px 0')}>
        <button onClick={() => setStatus('Photo scanning isn’t available yet — paste the caption instead.')} style={s(`flex:1;display:flex;flex-direction:column;gap:5px;padding:14px;border:1px solid ${LINE};border-radius:15px;background:${CARD};text-align:left`)}>
          <span style={s('font-size:15px')}>▣</span><b style={s('font-size:12.5px')}>Scan a photo</b><span style={s(`font-size:11px;color:${MUTED}`)}>Coming soon</span>
        </button>
        <button onClick={writeItMyself} style={s(`flex:1;display:flex;flex-direction:column;gap:5px;padding:14px;border:1px solid ${LINE};border-radius:15px;background:${CARD};text-align:left`)}>
          <span style={s('font-size:15px')}>✎</span><b style={s('font-size:12.5px')}>Write it myself</b><span style={s(`font-size:11px;color:${MUTED}`)}>Family recipes</span>
        </button>
      </div>
    </div>}

    {screen === 'extracting' && <div style={s(`flex:1;display:flex;flex-direction:column;padding:32px 24px 40px;box-sizing:border-box;background:${GREEN};color:#fffdf8`)}>
      <div style={s('display:flex;align-items:center;gap:10px')}>
        <span style={s(`display:inline-block;width:15px;height:15px;border:2px solid #ffffff40;border-top-color:${LIME};border-radius:50%;animation:omspin .8s linear infinite`)} />
        <span style={s(`font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${LIME}`)}>Extracting</span>
      </div>
      <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:28px;line-height:1.15;margin:14px 0 30px")}>Reading your recipe…</div>
      <div style={s('display:flex;flex-direction:column;gap:3px')}>
        {EXTRACT_STEPS.map((label, i) => {
          const done = i < extractIdx, now = i === extractIdx;
          const bg = done ? LIME : now ? '#ffffff2e' : '#ffffff14';
          const fg = done ? GREEN : '#fffdf8';
          const text = done || now ? '#fffdf8' : '#8fab8a';
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

    {(screen === 'review' || screen === 'edit') && reviewDraft && <div style={s('flex:1;display:flex;flex-direction:column;min-height:0')}>
      <div style={s('flex:1;overflow:auto;padding:20px 0 24px')}>
        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 20px')}>
          <button onClick={discardReview} style={s(`width:36px;height:36px;border:1px solid ${LINE};border-radius:50%;background:${CARD};font-size:15px`)}>‹</button>
          {extractSeconds != null && <span style={s(`display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:20px;background:${LIME};font-size:11.5px;font-weight:700`)}>✦ Extracted in {extractSeconds}s</span>}
        </div>
        <div style={s('padding:16px 20px 0')}>
          <div style={s('font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6d806b')}>{editRecipeId ? 'Edit recipe' : 'Check before saving'}</div>
          <input value={reviewDraft.draft.title} onChange={(e) => updateDraft('title', e.target.value)} placeholder="Recipe title" style={s("width:100%;margin-top:6px;padding:0;border:0;outline:0;background:transparent;font-family:'Playfair Display',serif;font-weight:700;font-size:27px;letter-spacing:-.5px;line-height:1.15;box-sizing:border-box")} />
          <div style={s('display:flex;gap:8px;flex-wrap:wrap;margin-top:12px')}>
            {(['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other'] as const).map((cat) => { const on = reviewDraft.draft.category === cat; return <button key={cat} onClick={() => updateDraft('category', cat)} style={s(`padding:7px 11px;border:1px solid ${on ? GREEN : LINE};border-radius:20px;background:${on ? GREEN : CARD};color:${on ? '#fff' : INK};font-size:11.5px;font-weight:600`)}>{cat}</button>; })}
          </div>
          <label style={s('display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:#6a7169')}>Servings
            <input type="number" min={1} value={reviewDraft.draft.servings ?? ''} onChange={(e) => updateDraft('servings', e.target.value ? Number(e.target.value) : null)} style={s(`width:64px;padding:7px 9px;border:1px solid ${LINE};border-radius:8px;background:${CARD}`)} />
          </label>
        </div>
        <div style={s(`margin:20px 20px 0;padding:14px 15px;border:1px solid ${LINE};border-radius:16px;background:${CARD}`)}>
          <div style={s('display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px')}>
            <b style={s("font-family:'Playfair Display',serif;font-size:16px")}>Ingredients</b>
            <span style={s(`font-size:11px;color:${MUTED}`)}>{reviewDraft.draft.ingredients.length} found</span>
          </div>
          {reviewDraft.draft.ingredients.map((ingredient, index) => <div key={index} style={s(`padding:9px 0;border-bottom:1px solid ${LINE}`)}>
            <div style={s('display:flex;align-items:center;gap:8px')}>
              <input aria-label="Quantity" value={ingredient.quantity ?? ''} onChange={(e) => updateIngredient(index, 'quantity', e.target.value)} placeholder="qty" style={s(`width:48px;padding:6px;border:1px solid ${LINE};border-radius:7px;font-size:12.5px`)} />
              <input aria-label="Unit" value={ingredient.unit ?? ''} onChange={(e) => updateIngredient(index, 'unit', e.target.value)} placeholder="unit" style={s(`width:52px;padding:6px;border:1px solid ${LINE};border-radius:7px;font-size:12.5px`)} />
              <input aria-label="Ingredient" value={ingredient.name} onChange={(e) => updateIngredient(index, 'name', e.target.value)} placeholder="ingredient" style={s(`flex:1;padding:6px 8px;border:1px solid ${LINE};border-radius:7px;font-size:13px;min-width:0`)} />
              <button onClick={() => removeIngredient(index)} aria-label="Remove" style={s(`border:0;background:transparent;color:${MUTED};font-size:16px`)}>×</button>
            </div>
            <div style={s('display:flex;gap:6px;margin-top:6px')}>
              {AISLES.map((aisle) => { const on = ingredient.aisle === aisle; return <button key={aisle} onClick={() => updateIngredientAisle(index, aisle)} style={s(`padding:4px 9px;border:1px solid ${on ? GREEN : LINE};border-radius:20px;background:${on ? GREEN : 'transparent'};color:${on ? '#fff' : MUTED};font-size:10.5px;font-weight:600`)}>{AISLE_SHORT[aisle]}</button>; })}
            </div>
          </div>)}
          <button onClick={addIngredient} style={s(`margin-top:10px;border:0;background:transparent;color:${GREEN};font-size:12.5px;font-weight:700`)}>+ Add an ingredient</button>
        </div>
        <div style={s(`margin:14px 20px 0;padding:14px 15px;border:1px solid ${LINE};border-radius:16px;background:${CARD}`)}>
          <b style={s("font-family:'Playfair Display',serif;font-size:16px")}>Method</b>
          {reviewDraft.draft.steps.map((step, index) => <div key={index} style={s('display:flex;gap:9px;align-items:flex-start;padding:8px 0')}>
            <b style={s(`color:${MUTED};font-size:13px;margin-top:9px`)}>{index + 1}.</b>
            <textarea value={step.instruction} onChange={(e) => updateStep(index, e.target.value)} style={s(`flex:1;padding:8px;border:1px solid ${LINE};border-radius:8px;font-size:13px;line-height:1.45;min-height:44px;font-family:inherit;box-sizing:border-box`)} />
            <button onClick={() => removeStep(index)} aria-label="Remove" style={s(`border:0;background:transparent;color:${MUTED};font-size:16px;margin-top:9px`)}>×</button>
          </div>)}
          <button onClick={addStep} style={s(`margin-top:6px;border:0;background:transparent;color:${GREEN};font-size:12.5px;font-weight:700`)}>+ Add a step</button>
        </div>
        {signedIn && <div style={s('margin:14px 20px 0;padding:14px 15px;border-radius:16px;background:#eaf1e5')}>
          <b style={s('font-size:12.5px')}>Save to a collection</b>
          <div style={s('display:flex;gap:8px;flex-wrap:wrap;margin-top:10px')}>
            {collectionsState.map((c) => { const on = selectedCollectionId === c.id; return <button key={c.id} onClick={() => setSelectedCollectionId(on ? null : c.id)} style={s(`padding:8px 12px;border-radius:20px;background:${on ? GREEN : 'transparent'};border:1px solid ${on ? GREEN : '#cfd8c8'};color:${on ? '#fff' : '#3f5240'};font-size:11.5px;font-weight:700`)}>{c.name}{on ? ' ✓' : ''}</button>; })}
          </div>
          <div style={s('display:flex;gap:8px;margin-top:10px')}>
            <input value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createCollectionInline()} placeholder="New collection name" style={s(`flex:1;padding:9px 11px;border:1px solid #cfd8c8;border-radius:10px;font-size:12.5px;background:#fff`)} />
            <button onClick={createCollectionInline} disabled={creatingCollection || !newCollectionName.trim()} style={s(`padding:0 14px;border:0;border-radius:10px;background:${GREEN};color:#fff;font-size:12px;font-weight:700`)}>{creatingCollection ? '…' : '+ New'}</button>
          </div>
        </div>}
        {status && <p style={s(`margin:14px 20px 0;font-size:12.5px;color:${MUTED}`)}>{status}</p>}
      </div>
      <div style={s(`padding:12px 20px 30px;border-top:1px solid ${LINE};background:${PAPER};display:flex;gap:10px`)}>
        <button onClick={discardReview} style={s(`padding:15px 16px;border:1px solid ${LINE};border-radius:14px;background:${CARD};font-size:14px;font-weight:700`)}>Discard</button>
        <button onClick={saveReview} disabled={!signedIn || saving} style={s(`flex:1;padding:15px;border:0;border-radius:14px;background:${GREEN};color:#fff;font-size:14.5px;font-weight:700;opacity:${!signedIn || saving ? 0.6 : 1}`)}>{saving ? 'Saving…' : !signedIn ? 'Sign in to save' : editRecipeId ? 'Save changes' : 'Save to vault'}</button>
      </div>
    </div>}

    {screen === 'detail' && active && <div style={s('flex:1;display:flex;flex-direction:column;min-height:0')}>
      <div style={s('flex:1;overflow:auto')}>
        <div style={s('position:relative')}>
          {active.img && <img src={active.img} alt="" style={s('width:100%;height:250px;object-fit:cover;display:block')} />}
          <div style={s('position:absolute;inset:0;background:linear-gradient(to top,#0e1a12e6 2%,#0e1a1200 55%)')} />
          <div style={s('position:absolute;top:16px;left:18px;right:18px;display:flex;justify-content:space-between')}>
            <button onClick={() => go('vault')} style={s('width:36px;height:36px;border:0;border-radius:50%;background:#fffdf8e8;font-size:15px')}>‹</button>
            {signedIn && <div style={s('display:flex;gap:8px')}>
              <button onClick={openEditRecipe} aria-label="Edit recipe" style={s('width:36px;height:36px;border:0;border-radius:50%;background:#fffdf8e8;font-size:15px')}>✎</button>
              <button onClick={deleteActiveRecipe} disabled={deletingRecipe} aria-label="Delete recipe" style={s(`width:36px;height:36px;border:0;border-radius:50%;background:#fffdf8e8;font-size:15px;color:${CORAL};opacity:${deletingRecipe ? 0.6 : 1}`)}>🗑</button>
            </div>}
          </div>
          <div style={s('position:absolute;left:20px;right:20px;bottom:16px;color:#fffdf8;display:flex;flex-direction:column;gap:7px')}>
            <span style={s('align-self:flex-start;padding:5px 10px;border-radius:20px;background:#fffdf8;color:#1c241d;font-size:10.5px;font-weight:700')}>{active.s}</span>
            <span style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;line-height:1.12")}>{active.t}</span>
            <span style={s('font-size:12px;color:#e4ece0')}>◷ {active.time} · serves {active.n * servings}</span>
          </div>
        </div>
        {active.sourceUrl && <div style={s('padding:16px 20px 0')}>
          <a href={active.sourceUrl} target="_blank" rel="noreferrer" style={s(`display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid ${LINE};border-radius:14px;background:${CARD};text-decoration:none;color:${INK}`)}>
            <span style={s('display:flex;flex-direction:column;gap:2px')}><b style={s('font-size:12.5px')}>{active.c}</b><span style={s(`font-size:11px;color:${MUTED}`)}>View the original post</span></span>
            <span style={s(`font-size:13px;color:${GREEN}`)}>↗</span>
          </a>
        </div>}
        <div style={s('padding:20px 20px 0')}>
          <div style={s('display:flex;align-items:center;justify-content:space-between')}>
            <h3 style={s("font-family:'Playfair Display',serif;font-size:19px;margin:0")}>Ingredients</h3>
            <div style={s(`display:flex;gap:3px;padding:3px;border:1px solid ${LINE};border-radius:11px;background:${CARD}`)}>
              {[1, 2, 3].map((v) => { const sg = seg(servings === v); return <button key={v} onClick={() => setServings(v)} style={s(`padding:6px 11px;border:0;border-radius:8px;background:${sg.bg};color:${sg.fg};font-size:12px;font-weight:700`)}>{v}×</button>; })}
            </div>
          </div>
          <div style={s('margin-top:10px')}>
            {active.a.map((ingredient) => <div key={ingredient.name} style={s(`display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid ${LINE};font-size:13.5px`)}>
              <span style={s('width:18px;height:18px;border:1.5px solid #cfd8c8;border-radius:5px;flex:none')} />
              <b style={s(`display:inline-block;width:62px;color:${CORAL};font-size:13px`)}>{scaleAmount(ingredient.amt, servings)}</b>
              <span>{ingredient.name}</span>
            </div>)}
          </div>
        </div>
        <div style={s('padding:22px 20px 0')}>
          <h3 style={s("font-family:'Playfair Display',serif;font-size:19px;margin:0 0 6px")}>Method</h3>
          {active.m.map((text, i) => <div key={i} style={s('display:flex;gap:11px;padding:10px 0;font-size:13.5px;line-height:1.5')}>
            <b style={s(`color:${MUTED}`)}>{i + 1}.</b><span>{text}</span>
          </div>)}
        </div>
        <div style={s('margin:18px 20px 24px;padding:16px;border-radius:16px;background:#eaf1e5')}>
          <b style={s('font-size:13px')}>✦ Ask your AI sous-chef</b>
          <div style={s('display:flex;gap:8px;margin-top:11px')}>
            <input value={chefQuestion} onChange={(e) => setChefQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askChef()} placeholder="What can I substitute for cream?" style={s('flex:1;padding:11px;border:0;border-radius:10px;background:#fff;font-size:12.5px;color:#6a7169')} />
            <button onClick={askChef} disabled={chefLoading} style={s(`padding:0 15px;border:0;border-radius:10px;background:${GREEN};color:#fff;font-size:13px;font-weight:700`)}>{chefLoading ? '…' : 'Ask'}</button>
          </div>
          {chefReply && <p style={s('font-size:12.5px;line-height:1.5;color:#405642;margin:11px 0 0')}>{chefReply}</p>}
        </div>
      </div>
      <div style={s(`padding:12px 20px 30px;border-top:1px solid ${LINE};background:${PAPER};display:flex;gap:10px`)}>
        <button onClick={() => go('planner')} style={s(`padding:15px 16px;border:1px solid ${LINE};border-radius:14px;background:${CARD};font-size:14px;font-weight:700`)}>▦ Plan</button>
        <button onClick={startCook} style={s(`flex:1;padding:15px;border:0;border-radius:14px;background:${GREEN};color:#fff;font-size:14.5px;font-weight:700`)}>Start cooking</button>
      </div>
    </div>}

    {screen === 'cook' && active && <div style={s('flex:1;display:flex;flex-direction:column;min-height:0;background:#fffdf8')}>
      <div style={s('padding:20px 22px 0')}>
        <div style={s('display:flex;align-items:center;justify-content:space-between')}>
          <button onClick={() => go('detail')} style={s(`width:36px;height:36px;border:1px solid ${LINE};border-radius:50%;background:${PAPER};font-size:15px`)}>✕</button>
          <span style={s('padding:7px 12px;border-radius:20px;background:#eaf1e5;color:#244f3c;font-size:11.5px;font-weight:700')}>☀ Screen stays awake</span>
        </div>
        <div style={s('display:flex;gap:5px;margin-top:20px')}>
          {active.m.map((_, i) => <div key={i} style={s(`flex:1;height:4px;border-radius:99px;background:${i <= cookStep ? GREEN : LINE}`)} />)}
        </div>
        <div style={s('margin-top:14px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6d806b')}>Step {cookStep + 1} of {active.m.length} · {active.t}</div>
      </div>
      <div style={s('flex:1;overflow:auto;padding:14px 22px 0')}>
        <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:30px;line-height:1.2;letter-spacing:-.5px")}>{active.m[cookStep]}</div>
        <div style={s(`margin-top:22px;padding:15px;border-radius:15px;background:${PAPER};border:1px solid ${LINE}`)}>
          <div style={s('font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6d806b;margin-bottom:8px')}>For this step</div>
          {active.a.slice(cookStep, cookStep + 2).map((ingredient) => <div key={ingredient.name} style={s('display:flex;gap:9px;padding:5px 0;font-size:13.5px')}><b style={s(`width:62px;color:${CORAL}`)}>{scaleAmount(ingredient.amt, servings)}</b><span>{ingredient.name}</span></div>)}
        </div>
        <div style={s('display:flex;gap:10px;margin-top:14px')}>
          <button onClick={askChef} disabled={chefLoading} style={s(`flex:1;padding:13px;border:1px solid ${LINE};border-radius:14px;background:${PAPER};font-size:13px;font-weight:700`)}>{chefLoading ? 'Asking…' : '✦ Ask sous-chef'}</button>
        </div>
        {chefReply && <p style={s('margin:12px 0 0;padding:13px;border-radius:13px;background:#eaf1e5;font-size:12.5px;line-height:1.5;color:#405642')}>{chefReply}</p>}
      </div>
      <div style={s('padding:12px 22px 30px;display:flex;gap:10px')}>
        <button onClick={() => setCookStep((v) => Math.max(0, v - 1))} style={s(`padding:16px 18px;border:1px solid ${LINE};border-radius:14px;background:${PAPER};font-size:14px;font-weight:700`)}>‹</button>
        <button onClick={() => (cookStep === active.m.length - 1 ? go('detail') : setCookStep((v) => v + 1))} style={s(`flex:1;padding:16px;border:0;border-radius:14px;background:${GREEN};color:#fff;font-size:14.5px;font-weight:700`)}>{cookStep === active.m.length - 1 ? 'Finish cooking' : 'Next step'}</button>
      </div>
    </div>}

    {screen === 'planner' && <div style={s('flex:1;overflow:auto;padding:20px 0 100px')}>
      <div style={s('padding:0 20px')}>
        <div style={s('font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6d806b')}>This week</div>
        <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:29px;letter-spacing:-.6px;margin:5px 0 0")}>Meal plan, made simple.</div>
      </div>
      <div style={s(`margin:18px 20px 0;border:1px solid ${LINE};border-radius:18px;background:${CARD};overflow:hidden`)}>
        {weekDates.map((d, i) => { const rec = weekRecipes[i]; return <div key={d.iso} style={s(`display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid ${LINE}`)}>
          <span style={s(`width:34px;flex:none;font-size:11.5px;font-weight:700;color:${MUTED}`)}>{d.short}</span>
          {rec?.img && <img src={rec.img} alt="" style={s('width:44px;height:44px;border-radius:10px;object-fit:cover;flex:none')} />}
          <span style={s(`flex:1;font-size:13.5px;font-weight:600;line-height:1.3;color:${rec ? INK : '#9aa398'}`)}>{rec ? rec.t : 'Nothing planned yet'}</span>
          <button onClick={() => cycleDay(d.day, d.iso)} style={s('flex:none;border:0;border-radius:9px;padding:8px 11px;background:#eaf1e5;color:#244f3c;font-size:11.5px;font-weight:700')}>{rec ? 'Change' : 'Add'}</button>
        </div>; })}
      </div>
      <button onClick={() => go('grocery')} style={s('display:flex;align-items:center;justify-content:space-between;width:calc(100% - 40px);margin:14px 20px 0;padding:17px;border:0;border-radius:17px;background:#fbf0d8;text-align:left')}>
        <span style={s('display:flex;flex-direction:column;gap:3px')}>
          <b style={s("font-family:'Playfair Display',serif;font-size:17px")}>Smart grocery list</b>
          <span style={s(`font-size:12px;color:${MUTED}`)}>{groceryNames.length} items from {plannedCount} planned recipes</span>
        </span>
        <span style={s('font-size:15px;color:#8a6a1f')}>›</span>
      </button>
    </div>}

    {screen === 'grocery' && <div style={s(`flex:1;overflow:auto;padding:20px 0 100px;background:${PAPER}`)}>
      <div style={s('display:flex;align-items:center;gap:11px;padding:0 20px')}>
        <button onClick={() => go('planner')} style={s(`width:36px;height:36px;border:1px solid ${LINE};border-radius:50%;background:${CARD};font-size:15px`)}>‹</button>
        <span style={s(`font-size:13px;font-weight:700;color:${MUTED}`)}>Back to plan</span>
      </div>
      <div style={s('padding:16px 20px 0')}>
        <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:29px;letter-spacing:-.6px")}>Smart grocery list</div>
        <div style={s(`font-size:12.5px;color:${MUTED};margin-top:5px`)}>Merged from {plannedCount} planned recipes · {groceryNames.length} items</div>
      </div>
      {grocerySections.length === 0 && <p style={s(`padding:16px 20px 0;font-size:12.5px;color:${MUTED}`)}>Plan a few dinners to build your list.</p>}
      {grocerySections.map(([name, items]) => <div key={name} style={s('margin:16px 20px 0;padding:16px;border-radius:17px;background:#eef0e7')}>
        <div style={s(`font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${CORAL};margin-bottom:6px`)}>{name}</div>
        {items.map((item) => { const on = !!ticked[item]; return <button key={item} onClick={() => toggleTick(item)} style={s('display:flex;align-items:center;gap:11px;width:100%;padding:9px 0;border:0;background:transparent;text-align:left')}>
          <span style={s(`display:grid;place-items:center;width:19px;height:19px;flex:none;border:1.5px solid #cfc7ae;border-radius:5px;font-size:11px;color:#fff;background:${on ? GREEN : 'transparent'}`)}>{on ? '✓' : ''}</span>
          <span style={s(`font-size:13.5px;color:${on ? '#9aa398' : INK};text-decoration:${on ? 'line-through' : 'none'}`)}>{item}</span>
        </button>; })}
      </div>)}
      <div style={s(`margin:16px 20px 0;font-size:12px;color:${MUTED}`)}>Tap an item to tick it off. Duplicates across recipes are merged automatically.</div>
    </div>}

    {screen === 'profile' && <div style={s('flex:1;overflow:auto;padding:20px 0 100px')}>
      {!signedIn ? <div style={s('padding:20px')}>
        <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:24px")}>You&apos;re browsing a preview</div>
        <p style={s(`font-size:13px;line-height:1.6;color:${MUTED};margin-top:8px`)}>{configured ? 'Sign in to see your own stats, collections and settings.' : 'Sign-in isn’t configured for this deployment yet.'}</p>
        {configured && <a href="/login" style={s(`display:inline-block;margin-top:14px;padding:13px 20px;border-radius:14px;background:${GREEN};color:#fff;font-size:13.5px;font-weight:700;text-decoration:none`)}>Sign in</a>}
      </div> : <>
        <div style={s('display:flex;align-items:center;gap:14px;padding:0 20px')}>
          <span style={s(`display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:${CORAL};color:#fff;font-weight:700;font-size:19px`)}>{(user?.email ?? '?').slice(0, 2).toUpperCase()}</span>
          <span style={s('display:flex;flex-direction:column;gap:3px')}>
            <b style={s("font-family:'Playfair Display',serif;font-size:21px")}>{user?.email}</b>
            <span style={s(`font-size:12px;color:${MUTED}`)}>{collections.length} collections</span>
          </span>
        </div>
        <div style={s('display:flex;gap:10px;padding:18px 20px 0')}>
          {[{ v: recipes.length, k: 'recipes saved' }, { v: collections.length, k: 'collections' }, { v: mealPlan.length, k: 'meals planned' }].map((stat) => <div key={stat.k} style={s(`flex:1;padding:14px 12px;border:1px solid ${LINE};border-radius:15px;background:${CARD}`)}>
            <div style={s("font-family:'Playfair Display',serif;font-weight:700;font-size:24px")}>{stat.v}</div>
            <div style={s(`font-size:11px;color:${MUTED}`)}>{stat.k}</div>
          </div>)}
        </div>
        {collections.length > 0 && <>
          <div style={s("padding:26px 20px 10px;font-family:'Playfair Display',serif;font-size:18px;font-weight:700")}>Collections</div>
          <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 20px')}>
            {collections.map((c) => <button key={c.id} onClick={() => openCollection(c.id)} style={s(`display:flex;flex-direction:column;justify-content:space-between;gap:26px;padding:14px;border:1px solid ${LINE};border-radius:16px;background:${c.bg};text-align:left`)}>
              <span style={s('font-size:18px')}>{c.glyph}</span>
              <span style={s('display:flex;flex-direction:column;gap:2px')}><b style={s('font-size:14px')}>{c.name}</b><span style={s(`font-size:11.5px;color:${MUTED}`)}>{c.count} recipes</span></span>
            </button>)}
          </div>
        </>}
        <div style={s(`margin:22px 20px 0;border:1px solid ${LINE};border-radius:17px;background:${CARD};overflow:hidden`)}>
          {[{ glyph: '◉', label: 'Data & sync', value: 'Neon' }, { glyph: '✦', label: 'AI sous-chef', value: 'Groq + Gemini' }, { glyph: '▣', label: 'Units', value: 'Metric' }, { glyph: '◌', label: 'Notifications', value: 'Coming soon' }].map((row) => <div key={row.label} style={s(`display:flex;align-items:center;justify-content:space-between;padding:15px;border-bottom:1px solid ${LINE};font-size:13.5px`)}>
            <span style={s('display:flex;align-items:center;gap:11px')}><span style={s(`color:${MUTED}`)}>{row.glyph}</span>{row.label}</span>
            <span style={s(`font-size:12px;color:${MUTED}`)}>{row.value}</span>
          </div>)}
        </div>
      </>}
    </div>}

    {showTabs && <div style={s(`position:relative;z-index:30;display:flex;align-items:flex-start;justify-content:space-around;padding:9px 8px calc(env(safe-area-inset-bottom,0px) + 18px);border-top:1px solid ${LINE};background:#fffdf8f2;backdrop-filter:blur(12px)`)}>
      {[{ label: 'Vault', glyph: '◈', screen: 'vault' as Screen }, { label: 'Plan', glyph: '▦', screen: 'planner' as Screen }, { label: '', glyph: '', screen: null }, { label: 'List', glyph: '☰', screen: 'grocery' as Screen }, { label: 'You', glyph: '◉', screen: 'profile' as Screen }].map((t, i) => t.screen ? <button key={i} onClick={() => go(t.screen as Screen)} style={s(`display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;padding:6px 0;border:0;background:transparent;color:${screen === t.screen ? GREEN : '#9aa398'}`)}>
        <span style={s('font-size:17px')}>{t.glyph}</span>
        <span style={s('font-size:10px;font-weight:700')}>{t.label}</span>
      </button> : <span key={i} style={s('flex:1')} />)}
      <button onClick={() => go('import')} style={s(`position:absolute;left:50%;top:-22px;transform:translateX(-50%);display:grid;place-items:center;width:54px;height:54px;border:4px solid ${PAPER};border-radius:50%;background:${GREEN};color:#fff;font-size:22px;font-weight:700;box-shadow:0 6px 18px #244f3c4d`)}>+</button>
    </div>}
  </main>;
}
