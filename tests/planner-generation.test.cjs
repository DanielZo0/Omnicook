require('./register-ts.cjs');const {test}=require('node:test'),assert=require('node:assert/strict');
const {generatePlan}=require('../src/lib/planner/generate.ts');const {defaultPreferences}=require('../src/lib/planner/schemas.ts');const {unavailableEstimate}=require('../src/lib/nutrition/types.ts');
const recipe=(key,extra={})=>({key,title:key,ingredients:[{name:'oats',position:0,quantity:'100',unit:'g',notes:null}],steps:[{position:0,instruction:'Mix.'}],servings:1,category:'Other',prepMinutes:5,cookMinutes:0,source:{kind:'recipe',recipeId:key},revision:'1',nutrition:unavailableEstimate(),plantFoods:[],fermentedFoods:[],...extra});
const state=(recipes,entries=[],prefs={})=>({weekStart:'2026-10-19',revision:0,entries,recipes,preferences:{...defaultPreferences(),enabledSlots:['dinner'],...prefs},capabilities:{}});
test('generation preserves locked entries and only changes requested swap',()=>{
 const a=recipe('a'),b=recipe('b'),entry={id:'11111111-1111-4111-8111-111111111111',plannedFor:'2026-10-19',mealSlot:'dinner',source:{kind:'recipe',recipeId:'a'},recipe:a,locked:true,servings:1,version:1};
 const draft=generatePlan(state([a,b],[entry]),{weekStart:'2026-10-19',day:'2026-10-19',unlockedIds:[]},'guest');assert.deepEqual(draft.entries,[entry]);
 const swap=generatePlan(state([a,b],[entry]),{weekStart:'2026-10-19',swap:{plannedFor:'2026-10-19',mealSlot:'dinner'},unlockedIds:['11111111-1111-4111-8111-111111111111']},'guest');assert.equal(swap.entries.length,1);assert.equal(swap.entries[0].recipe.key,'b');
});
test('incomplete nutrition cannot meet calorie goals and constraints are never silently relaxed',()=>{
 const draft=generatePlan(state([recipe('a')],[],{kcalTarget:2000}),{weekStart:'2026-10-19',day:'2026-10-19'},'guest');assert.equal(draft.entries.length,0);assert.ok(draft.unmetGoals.length);
 const restricted=generatePlan(state([recipe('a',{ingredients:[{name:'mystery sauce'}]})],[],{excludedIngredients:['milk']}),{weekStart:'2026-10-19',day:'2026-10-19'},'guest');assert.equal(restricted.entries.length,0);
 const timed=generatePlan(state([recipe('a',{prepMinutes:null})],[],{maxPreparationMinutes:20}),{weekStart:'2026-10-19',day:'2026-10-19'},'guest');assert.equal(timed.entries.length,0);
});
test('dismissing the only sourced suggestion leaves its slot empty and explains the gap',()=>{
 const suggested=recipe('new',{source:{kind:'suggestion',ref:{providerId:'fixture',externalId:'1'}}});const entry={id:'11111111-1111-4111-8111-111111111111',plannedFor:'2026-10-19',mealSlot:'dinner',source:{kind:'suggestion',snapshotId:'22222222-2222-4222-8222-222222222222'},recipe:suggested,locked:true,servings:1,version:1};
 const draft=generatePlan(state([suggested],[entry]),{weekStart:'2026-10-19',swap:{plannedFor:'2026-10-19',mealSlot:'dinner'},unlockedIds:[entry.id],dismissed:['new']},'guest');assert.equal(draft.entries.length,0);assert.ok(draft.unmetGoals.some(x=>x.includes('alternative')||x.includes('eligible')));
});


test('hard exclusions reject singular and plural nut ingredients',()=>{
 const {eligibleRecipe}=require('../src/lib/planner/foods.ts');
 for(const [excluded,name] of [['peanut','peanuts'],['peanuts','peanut'],['almond','almonds'],['nut','walnuts'],['nuts','walnut']]){
 assert.equal(eligibleRecipe(recipe('a',{ingredients:[{name}]}),{...defaultPreferences(),excludedIngredients:[excluded]}),false,excluded+' / '+name);
 }
});
