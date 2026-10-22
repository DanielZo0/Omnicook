require('./register-ts.cjs');const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('module');const load=Module._load;Module._load=function(n,...a){return n==='server-only'?{}:load.call(this,n,...a)};
const {normalizeMeal}=require('../src/lib/suggestions/providers/themealdb.ts');
test('sourced recipes retain attribution and unknown yield instead of invented servings',()=>{
 const r=normalizeMeal({idMeal:'1',strMeal:'Oats',strInstructions:'Mix oats and milk.',strIngredient1:'Oats',strMeasure1:'100 g',strSource:'https://example.com/oats'});
 assert.equal(r.servings,null);assert.equal(r.ref.providerId,'themealdb');assert.equal(r.ingredients[0].quantity,'100');assert.equal(r.ingredients[0].unit,'g');
 assert.throws(()=>normalizeMeal({idMeal:'1',strMeal:'Empty',strInstructions:''}));
});
