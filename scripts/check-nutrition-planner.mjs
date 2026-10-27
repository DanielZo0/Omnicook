import fs from 'node:fs';import dotenv from 'dotenv';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';import path from 'node:path';import assert from 'node:assert/strict';import {neon} from '@neondatabase/serverless';
const env=dotenv.parse(fs.readFileSync(process.argv[2]||'.env.integration.local'));
if(env.NEON_BRANCH_KIND!=='integration'||new URL(env.DATABASE_URL).hostname!==process.argv[3])throw Error('Explicit independently verified integration endpoint required.');
process.env.DATABASE_URL=env.DATABASE_URL;process.env.RECIPE_PHOTOS_ENABLED='false';process.env.NUTRIENT_PROVIDER='disabled';process.env.RECIPE_SUGGESTION_PROVIDER='disabled';
const require=createRequire(import.meta.url);require('../tests/register-ts.cjs');const Module=require('node:module'),load=Module._load,resolve=Module._resolveFilename;
const users=['planner-a-'+randomUUID(),'planner-b-'+randomUUID()];let actor=users[0],checks=0;
Module._resolveFilename=function(n,...a){return resolve.call(this,n.startsWith('@/')?path.resolve('src',n.slice(2)):n,...a);};Module._load=function(n,...a){if(n==='server-only')return {};if(n.endsWith('/auth/require-user'))return {requireUserId:async()=>actor};return load.call(this,n,...a);};
const sql=neon(env.DATABASE_URL);const route=require('../src/app/api/meal-plan/route.ts');const {createGeneration,applyGeneration}=require('../src/lib/planner/generation-store.ts');const {getPlannerWeek}=require('../src/lib/planner/repository.ts');
const {defaultPreferences}=require('../src/lib/planner/schemas.ts');
const {saveSuggestionToCookbook}=require('../src/lib/suggestions/repository.ts');
const {savePreferences}=require('../src/lib/planner/repository.ts');
const ok=(value)=>{assert.ok(value);checks++;};const request=(method,body)=>new Request('https://integration.local/api/meal-plan?week=2026-10-19',{method,headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const recipeId=randomUUID();
try{
 await sql`INSERT INTO recipes(id,user_id,title,category,servings,prep_minutes,cook_minutes) VALUES(${recipeId},${users[0]},'Planner fixture','Other',1,5,0)`;
 await sql`INSERT INTO recipe_ingredients(recipe_id,position,quantity,unit,name) VALUES(${recipeId},0,'100','g','oats')`;
 await sql`INSERT INTO recipe_steps(recipe_id,position,instruction) VALUES(${recipeId},0,'Mix oats.')`;
 const payload={recipeId,plannedFor:'2026-10-19',mealSlot:'dinner',expectedRevision:0,servings:1};
 ok((await route.POST(request('POST',{...payload,plannedFor:'2026-02-30'}))).status===400);
 actor=users[1];ok((await route.POST(request('POST',payload))).status===404);actor=null;ok((await route.GET(request('GET'))).status===401);actor=users[0];
 const save=await route.POST(request('POST',payload));ok(save.status===200);const saved=await save.json();const entry=saved.state.entries[0];ok(entry.recipe.title==='Planner fixture');
 ok((await route.POST(request('POST',payload))).status===409);
 actor=users[1];ok((await route.DELETE(request('DELETE',{id:entry.id,expectedRevision:0}))).status===404);actor=users[0];
 const draft=await createGeneration(actor,{weekStart:'2026-10-19',day:'2026-10-20',sourceMode:'saved',unlockedIds:[],dismissed:[]});
 ok(draft.entries.find(e=>e.id===entry.id).plannedFor==='2026-10-19');
 const key=randomUUID(),applied=await applyGeneration(actor,draft.id,key);ok(applied.entries.length===5); // all four enabled slots plus locked Monday dinner
 const retry=await applyGeneration(actor,draft.id,key);ok(retry.revision===applied.revision);
 await assert.rejects(()=>applyGeneration(users[1],draft.id,randomUUID()),e=>e.status===404);checks++;
 const stale=await createGeneration(actor,{weekStart:'2026-10-19',day:'2026-10-21',sourceMode:'saved',unlockedIds:[],dismissed:[]});
 await sql`UPDATE recipes SET title='Changed fixture' WHERE id=${recipeId}`;
 await assert.rejects(()=>applyGeneration(actor,stale.id,randomUUID()),e=>e.status===409);checks++;
 const after=await getPlannerWeek(actor,'2026-10-19');ok(after.entries.length===5);
 const expired=await createGeneration(actor,{weekStart:'2026-10-19',day:'2026-10-22',sourceMode:'saved',unlockedIds:[],dismissed:[]});
 await sql`UPDATE planner_generations SET expires_at=now()-interval '1 minute' WHERE id=${expired.id}`;
 await assert.rejects(()=>applyGeneration(actor,expired.id,randomUUID()),e=>e.status===409);checks++;
 // Force a late statement failure in a server-side fixture draft to prove rollback.
 const broken=await createGeneration(actor,{weekStart:'2026-10-19',day:'2026-10-23',sourceMode:'saved',unlockedIds:[],dismissed:[]});
 const newRows=broken.entries.filter(e=>e.plannedFor==='2026-10-23');newRows[newRows.length-1].servings='not-a-number';
 await sql`UPDATE planner_generations SET draft=${JSON.stringify(broken)}::jsonb WHERE id=${broken.id}`;
 await assert.rejects(()=>applyGeneration(actor,broken.id,randomUUID()));checks++;
 ok((await getPlannerWeek(actor,'2026-10-19')).entries.length===5);
 const snapshotId=randomUUID();const existing=(await getPlannerWeek(actor,'2026-10-19')).recipes[0];const sourced={...existing,key:'fixture-suggestion',source:{kind:'suggestion',ref:{providerId:'fixture',externalId:'123',normalizationVersion:'1',retrievedAt:new Date().toISOString(),sourceUrl:'https://example.com/recipe',attribution:'Fixture licensed recipe'}},imageLicence:'Fixture CC0'};
 await sql`INSERT INTO planner_snapshots(id,user_id,recipe) VALUES(${snapshotId},${actor},${JSON.stringify(sourced)}::jsonb)`;
 await sql`INSERT INTO meal_plan_items(user_id,snapshot_id,planned_for,meal_slot) VALUES(${actor},${snapshotId},'2026-10-24','dinner')`;
 ok((await sql`SELECT id FROM recipes WHERE user_id=${actor}`).length===1);
 ok((await getPlannerWeek(actor,'2026-10-19')).entries.some(e=>e.source.kind==='suggestion'&&e.recipe.title===sourced.title));
 await assert.rejects(()=>saveSuggestionToCookbook(users[1],snapshotId),e=>e.status===404);checks++;
 const savedSuggestion=await saveSuggestionToCookbook(actor,snapshotId);const retrySuggestion=await saveSuggestionToCookbook(actor,snapshotId);ok(savedSuggestion.recipeId===retrySuggestion.recipeId);
 ok((await sql`SELECT id FROM recipes WHERE user_id=${actor}`).length===2);
 const currentRevision=(await getPlannerWeek(actor,'2026-10-19')).revision;
 const deleted=await route.DELETE(request('DELETE',{id:entry.id,expectedRevision:currentRevision}));ok(deleted.status===200);
 ok((await sql`SELECT id FROM recipes WHERE id=${recipeId}`).length===1);
 const preferenceDraft=await createGeneration(actor,{weekStart:'2026-10-19',day:'2026-10-25',sourceMode:'saved',unlockedIds:[],dismissed:[]});
 const prefs=await savePreferences(actor,{...defaultPreferences(),kcalTarget:2000},0);ok(prefs.version===1);
 ok((await getPlannerWeek(actor,'2026-10-19')).preferences.kcalTarget===2000);
 ok((await getPlannerWeek(users[1],'2026-10-19')).preferences.kcalTarget===null);
 await assert.rejects(()=>savePreferences(actor,defaultPreferences(),0),e=>e.status===409);checks++;
 await assert.rejects(()=>applyGeneration(actor,preferenceDraft.id,randomUUID()),e=>e.status===409);checks++;
 console.log(JSON.stringify({checks,scope:'actual planner handlers, transactional SQL and generated Apply; isolated identities, no production auth writes'}));
}finally{
 for(const user of users){await sql`DELETE FROM planner_applications WHERE user_id=${user}`;await sql`DELETE FROM planner_generations WHERE user_id=${user}`;await sql`DELETE FROM meal_plan_items WHERE user_id=${user}`;await sql`DELETE FROM planner_snapshots WHERE user_id=${user}`;await sql`DELETE FROM recipes WHERE user_id=${user}`;await sql`DELETE FROM planner_state WHERE user_id=${user}`;}
 Module._load=load;Module._resolveFilename=resolve;console.log('Planner integration fixtures removed.');
}
