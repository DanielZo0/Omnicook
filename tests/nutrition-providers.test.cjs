require('./register-ts.cjs');const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('module');const load=Module._load;Module._load=function(n,...a){return n==='server-only'?{}:load.call(this,n,...a);};
const {UsdaProvider}=require('../src/lib/nutrition/providers/usda.ts');const {nutrientProvider}=require('../src/lib/nutrition/providers/registry.ts');
test('USDA adapter converts documented nutrients but leaves missing values unknown',async()=>{
 const previous=global.fetch;global.fetch=async()=>Response.json({fdcId:123,description:'Oats, raw',foodNutrients:[{nutrient:{id:1008},amount:390},{nutrient:{id:1003},amount:16}],foodPortions:[{gramWeight:120,amount:1,measureUnit:{name:'cup'}}]});
 try{const food=await new UsdaProvider('fixture-key').getFood('123',AbortSignal.timeout(1000));assert.equal(food.nutrientsPer100g.kcal.min,390);assert.equal(food.nutrientsPer100g.fibreG,null);assert.equal(food.state,'raw');assert.equal(food.portions[0].grams,120);}finally{global.fetch=previous;}
});
test('provider missing/disabled and rate limits have explicit unavailable outcomes',async()=>{
 const old=process.env.NUTRIENT_PROVIDER;process.env.NUTRIENT_PROVIDER='disabled';assert.equal(nutrientProvider(),null);if(old===undefined)delete process.env.NUTRIENT_PROVIDER;else process.env.NUTRIENT_PROVIDER=old;
 const previous=global.fetch;global.fetch=async()=>new Response('',{status:429});try{await assert.rejects(()=>new UsdaProvider('fixture-secret').search('oats',AbortSignal.timeout(1000)),e=>e.message.includes('rate limited')&&!e.message.includes('fixture-secret'));}finally{global.fetch=previous;}
});
