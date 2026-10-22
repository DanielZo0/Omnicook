require('./register-ts.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {matchRecipe}=require('../src/lib/extraction/match-recipe.ts');
const recipe=(ingredients,extra={})=>({title:'Nascondini fatti in casa',ingredients:ingredients.map(([name,quantity,unit],position)=>({name,quantity,unit,position})),steps:[{instruction:'Impastate e infornate.',position:0}],completeness:'complete',missingFields:[],...extra});
const base=[['farina','350','g'],['burro','140','g'],['latte','80','ml']];
test('matching accepts fractions/metric equivalents and rejects conflicts',()=>{
 const a=recipe(base),b=recipe([['farina','0,35','kg'],['burro','140','g'],['latte','0.08','l']],{title:'Nascondini'});
 assert.equal(matchRecipe(a,b).matches,true);
 assert.equal(matchRecipe(a,recipe([['farina','350','g'],['burro','150','g'],['latte','80','ml']])).matches,false);
 assert.equal(matchRecipe(a,recipe(base,{title:'Pancakes'})).matches,false);
 assert.equal(matchRecipe(a,recipe(base,{completeness:'incomplete'})).matches,false);
 assert.equal(matchRecipe(recipe(base.slice(0,2)),recipe(base)).matches,false);
});
test('coverage uses all quantified entries, duplicates cannot reuse matches',()=>{
 const a=recipe([...base,['zucchero','180','g'],['sale','1','pizzico']]);
 assert.equal(matchRecipe(a,recipe([...base,['zucchero','180','g']])).matches,true);
 assert.equal(matchRecipe(a,recipe(base)).matches,false);
 assert.equal(matchRecipe(recipe([...base,['latte','80','ml']]),recipe(base)).matches,false);
 assert.equal(matchRecipe(recipe(base,{servings:4}),recipe(base,{servings:8})).matches,false);
});
test('count/weight cannot match and unknown quantities count against coverage',()=>{
 const x=recipe([['farina','1/2','cup'],['burro','140','g'],['latte','80','ml']]);
 assert.equal(matchRecipe(x,recipe([['farina','0.5','cup'],...base.slice(1)])).matches,true);
 assert.equal(matchRecipe(x,recipe([['farina','0.5','g'],...base.slice(1)])).matches,false);
});
