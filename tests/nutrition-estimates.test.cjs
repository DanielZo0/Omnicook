require('./register-ts.cjs');const {test}=require('node:test'),assert=require('node:assert/strict');
const {estimateRecipe,recipeFingerprint}=require('../src/lib/nutrition/estimate.ts');const {evaluateDay}=require('../src/lib/nutrition/targets.ts');
const {defaultPreferences}=require('../src/lib/planner/schemas.ts');
const ref={providerId:'fixture',externalId:'a',normalizationVersion:'1',retrievedAt:'2026-10-22T00:00:00Z',sourceUrl:'https://example.com/food',attribution:'fixture'};
const nutrients={kcal:{min:100,max:100},proteinG:{min:10,max:10},fibreG:{min:5,max:5},carbohydrateG:null,fatG:null};
const recipe={ingredients:[{position:0,name:'oats',quantity:'200',unit:'g',notes:null}],servings:4};
const matches={0:{ref,name:'oats',state:'raw',nutrientsPer100g:nutrients,portions:[]}};
test('nutrition sums documented amounts and respects unknown yield/quantity and stale fingerprints',()=>{
 const x=estimateRecipe(recipe,matches);assert.equal(x.nutrients.kcal.min,200);assert.equal(x.status,'complete');
 assert.notEqual(recipeFingerprint(recipe),recipeFingerprint({...recipe,servings:2}));
 assert.equal(estimateRecipe({...recipe,servings:null},matches).status,'partial');
 assert.equal(estimateRecipe({...recipe,ingredients:[{...recipe.ingredients[0],quantity:null}]},matches).status,'unavailable');
 assert.equal(estimateRecipe({...recipe,ingredients:[{...recipe.ingredients[0],name:'cooked oats'}]},matches).status,'unavailable');
 const summary=evaluateDay([{servings:1,recipe:{...recipe,nutrition:x}}],defaultPreferences(),true);assert.equal(summary.nutrients.kcal.min,50);
});
test('whole calorie range and lower protein/fibre bounds must meet targets; partial day is never complete',()=>{
 const p={...defaultPreferences(),kcalTarget:2000,proteinMinimumG:60};
 const entry=(lo,hi,protein)=>({servings:1,recipe:{servings:1,nutrition:{status:'complete',nutrients:{...nutrients,kcal:{min:lo,max:hi},proteinG:{min:protein,max:90}},missing:[]}}});
 assert.equal(evaluateDay([entry(1800,2200,60)],p,true).targetsMet,true);
 assert.equal(evaluateDay([entry(1799,2200,60)],p,true).targetsMet,false);
 assert.equal(evaluateDay([entry(1800,2200,59)],p,true).targetsMet,false);
 assert.equal(evaluateDay([entry(1800,2200,60)],p,false).targetsMet,false);
 assert.equal(evaluateDay([],p,true).targetsMet,false);
});
