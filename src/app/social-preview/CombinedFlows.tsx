'use client';

import { useEffect, useRef, useState } from 'react';
import { PreviewBack } from './PreviewBack';
import { KitchenIcon } from '@/components/KitchenIcon';

export type PreviewRecipe = {
  id: number; title: string; author: string; cuisine: string; time: number | null; yieldServings: number;
  image: string; note: string; likes: number; own?: boolean; adapted?: boolean;
  baseId?: number; substitution?: string; sourceUrl?: string; source?: string;
  customIngredients?: string[]; customSteps?: string[];
};

export function ImportPreview({ onSave, onCancel }: { onSave: (recipe: PreviewRecipe) => void; onCancel: () => void }) {
  const [stage, setStage] = useState<'source' | 'review'>('source');
  const [url, setUrl] = useState('');
  const [manual, setManual] = useState(false);
  const [title, setTitle] = useState('Lemon & herb chickpea bowls');
  const [ingredientText, setIngredientText] = useState('400 g cooked chickpeas\n1 cucumber\n2 tomatoes\n2 tbsp tahini\n1 lemon\nA handful of fresh parsley');
  const [stepText, setStepText] = useState('Chop the cucumber and tomatoes. Toss with the chickpeas and parsley.\nWhisk tahini with lemon and a splash of water. Spoon over the bowls.');
  const [yieldText, setYieldText] = useState('4');
  const [timeText, setTimeText] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [error, setError] = useState('');
  function discardDraft(){setStage('source');setUrl('');setManual(false);setTitle('Lemon & herb chickpea bowls');setIngredientText('400 g cooked chickpeas\n1 cucumber\n2 tomatoes\n2 tbsp tahini\n1 lemon\nA handful of fresh parsley');setStepText('Chop the cucumber and tomatoes. Toss with the chickpeas and parsley.\nWhisk tahini with lemon and a splash of water. Spoon over the bowls.');setYieldText('4');setTimeText('');setCuisine('');setError('');}
  return <section className="cp-import">
    <PreviewBack onClick={onCancel}>Back to Cookbook</PreviewBack>
    <div className="cp-flow-heading"><span className="sp-tag">{stage === 'source' ? 'Bring your favourites home' : manual ? 'Your recipe, your way' : 'Review before you save'}</span><h1>{stage === 'source' ? 'Found something delicious?' : 'Make room in your cookbook.'}</h1><p>{stage === 'source' ? 'A recipe link, a family favourite, a little inspiration. Keep it all here.' : 'Check the ingredients and method. Everything below is editable.'}</p></div>
    {stage === 'review' && <div className="ux-draft-notice"><span>Draft kept while you move around this preview.</span><button className="sp-text-button" onClick={discardDraft}>Discard draft</button></div>}
    {stage === 'source' ? <div className="cp-import-layout"><div className="cp-import-panel"><KitchenIcon name="arrow" size={30}/><h2>Start with a link.</h2><p>From a recipe website, Instagram, YouTube, Pinterest or Facebook.</p><form onSubmit={e => { e.preventDefault(); try { const source = new URL(url); if (!['http:', 'https:'].includes(source.protocol)) throw new Error(); setError(''); setStage('review'); } catch { setError('Enter a full recipe URL starting with https://.'); } }}><label className="sp-field">Recipe link<input type="url" required placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)}/></label>{error && <p role="alert">{error}</p>}<button className="sp-primary sp-full">Preview import</button></form><div className="cp-demo-note"><strong>A sample import, ready to try.</strong><p>This walkthrough uses a chickpea bowl recipe. Your link isn’t fetched, and nothing is saved to your account.</p></div></div><div className="cp-manual-panel"><KitchenIcon name="book" size={38}/><h2>Some recipes aren’t on the internet.</h2><p>The ones on handwritten scraps. The ones you know by heart. Give them a home, too.</p><button className="sp-secondary" onClick={() => { if(!manual){setManual(true);setTitle('');setIngredientText('');setStepText('');setYieldText('');setTimeText('');setCuisine('');}setStage('review'); }}>Write my own recipe</button><p className="sp-group-only">Your recipes start private. Share them when you’re ready.</p></div></div> : <form className="cp-review-layout" onSubmit={e => { e.preventDefault(); if (!title.trim() || !ingredientText.trim() || !stepText.trim()) { setError('Add a title, ingredients and at least one method step.'); return; } const yieldServings = Number(yieldText); const time = timeText.trim() ? Number(timeText) : null; if (!Number.isInteger(yieldServings) || yieldServings < 1 || yieldServings > 100 || (time !== null && (!Number.isInteger(time) || time < 1 || time > 1440))) { setError('Enter 1–100 base servings and, if known, 1–1440 minutes.'); return; } const recipe:PreviewRecipe = { id: Date.now(), title: title.trim(), author: 'You', cuisine: cuisine.trim(), time, yieldServings, image: '/recipe-placeholder.svg', note: manual ? 'A recipe from your own kitchen.' : 'Imported and reviewed by you. Ready to cook or share with family.', likes: 0, own: true, source: manual ? 'My recipe' : 'Web import', sourceUrl: manual ? undefined : url, customIngredients: ingredientText.split('\n').filter(s => s.trim()), customSteps: stepText.split('\n').filter(s => s.trim()) };discardDraft();onSave(recipe); }}>
      <div><label className="sp-field">Recipe title<input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)}/></label><div className="cp-recipe-metadata"><label className="sp-field">Base servings<input type="number" required min="1" max="100" step="1" value={yieldText} onChange={e => setYieldText(e.target.value)}/></label><label className="sp-field">Total time in minutes (optional)<input type="number" min="1" max="1440" step="1" value={timeText} onChange={e => setTimeText(e.target.value)} placeholder="Not set"/></label><label className="sp-field">Cuisine (optional)<input maxLength={60} value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="Not set"/></label></div><p className="sp-muted">Ingredient amounts below make the base servings you enter.</p><label className="sp-field">Ingredients · one per line<textarea required rows={9} value={ingredientText} onChange={e => setIngredientText(e.target.value)}/></label></div><div><label className="sp-field">Method · one step per line<textarea required rows={9} value={stepText} onChange={e => setStepText(e.target.value)}/></label><div className="cp-demo-note"><strong>Private until you choose to share.</strong><p>Saving adds this recipe to your personal cookbook. Family sharing and public publishing are separate choices.</p></div>{error && <p role="alert">{error}</p>}<div className="cp-form-actions"><button type="button" className="sp-secondary" onClick={() => setStage('source')}>Back</button><button className="sp-primary">Save to my cookbook</button></div></div>
    </form>}
  </section>;
}

export function CookingPreview({ recipe, steps, ingredients, onClose, onComplete }: { recipe: PreviewRecipe; steps: string[]; ingredients: string[]; onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [help, setHelp] = useState(false);
  const [awake, setAwake] = useState(false);
  const [awakeMessage, setAwakeMessage] = useState('');
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const alive = useRef(true);
  const waking = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; void wakeLock.current?.release(); }; }, []);
  async function toggleAwake() {
    if (waking.current) return;
    if (wakeLock.current && !wakeLock.current.released) { await wakeLock.current.release(); setAwake(false); setAwakeMessage('Your device now controls when the screen sleeps.'); return; }
    waking.current = true;
    try {
      if (!('wakeLock' in navigator)) { setAwakeMessage('This browser cannot keep the screen awake. You can adjust your device’s screen timeout.'); return; }
      const lock = await navigator.wakeLock.request('screen');
      if (!alive.current) { await lock.release(); return; }
      wakeLock.current = lock;
      lock.addEventListener('release', () => { if (alive.current) { setAwake(false); setAwakeMessage('Screen awake stopped. Tap Keep screen awake to enable it again.'); } });
      setAwake(true); setAwakeMessage('The screen stays awake while this cooking view is open and visible.');
    } catch { if (alive.current) { setAwake(false); setAwakeMessage('Screen awake is unavailable right now. You can still follow every step.'); } }
    finally { waking.current = false; }
  }
  return <section className="cp-cooking"><PreviewBack onClick={onClose}>Back to recipe</PreviewBack><div className="cp-flow-heading"><span className="sp-tag">Cooking mode</span><h1>{recipe.title}</h1><p>One step at a time. Everything you need, close at hand.</p><button className="sp-secondary cp-awake" aria-pressed={awake} onClick={() => void toggleAwake()}>{awake ? 'Screen stays awake ✓' : 'Keep screen awake'}</button>{awakeMessage && <p role="status">{awakeMessage}</p>}</div><div className="cp-cooking-panel"><div className="cp-step-meta"><span>Step {step + 1} of {steps.length}</span><span>{Math.round(((step + 1) / steps.length) * 100)}%</span></div><progress value={step + 1} max={steps.length}/><KitchenIcon name="spark" size={45}/><h2>{steps[step]}</h2><div className="cp-cooking-controls"><button className="sp-secondary" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Previous step</button>{step + 1 < steps.length ? <button className="sp-primary" onClick={() => setStep(s => s + 1)}>Next step</button> : <button className="sp-primary" onClick={onComplete}>Finish cooking</button>}</div></div><section className="cp-ingredients-at-hand"><h2>Ingredients at hand</h2><p>Tap an ingredient as you use it.</p>{ingredients.map((ingredient, index) => <label key={`${recipe.id}-${index}`}><input type="checkbox"/><span>{ingredient}</span></label>)}</section><button className="sp-text-button" onClick={() => setHelp(!help)}>Ask the sous-chef</button>{help && <div className="cp-demo-note"><strong>A little help in the kitchen · sample answer</strong><p>Read the whole step before you start, prepare your ingredients, and taste as you go. In the full app, your existing AI sous-chef can answer questions about the recipe.</p></div>}</section>;
}
