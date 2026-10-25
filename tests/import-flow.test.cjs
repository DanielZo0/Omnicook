require('./register-ts.cjs');
const {test,afterEach,mock}=require('node:test');const assert=require('node:assert/strict');const dns=require('node:dns/promises');
const {importRecipe}=require('../src/lib/extraction/import-recipe.ts');
const {importExtractionSchema}=require('../src/lib/extraction/import-schema.ts');
const partial=importExtractionSchema.parse({title:'Nascondini',ingredients:[['farina','350','g'],['burro','140','g'],['latte','80','ml']].map(([name,quantity,unit],position)=>({name,quantity,unit,position})),steps:[],completeness:'incomplete',missingFields:['instructions']});
const complete={...partial,steps:[{position:0,instruction:'Impastate poi infornate per 30 minuti.'}],completeness:'complete',missingFields:[]};
afterEach(()=>mock.restoreAll());
test('ingredients-only caption returns usable partial draft and complete Italian caption succeeds',async()=>{
 const provider={name:'groq',extract:async(_url,text,opts)=>{assert.equal(opts.mode,'import');return text==='complete'?complete:partial}};
 const a=await importRecipe({source:'caption'},provider);assert.equal(a.status,'incomplete');assert.equal(a.draft.ingredients.length,3);assert.equal(a.draft.steps.length,0);
 assert.equal((await importRecipe({source:'complete'},provider)).status,'complete');
});
test('matching creator page supplies full method with both links',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const urls={'https://www.instagram.com/p/abc/':'<meta property="og:description" content="Nascondini: 350 g farina, 140 g burro, 80 ml latte. Originale https://chef.example/nascondini">','https://chef.example/nascondini':'<title>Nascondini</title><p>350 g farina. Impastate e infornate.</p>'};
 mock.method(global,'fetch',async u=>new Response(urls[String(u)]||'',{headers:{'Content-Type':'text/html'}}));
 const provider={name:'groq',extract:async url=>url.includes('instagram')?partial:complete};
 const r=await importRecipe({source:'https://www.instagram.com/p/abc/'},provider);assert.equal(r.status,'complete');assert.equal(r.sourceUrl,'https://www.instagram.com/p/abc/');assert.equal(r.originalRecipeUrl,'https://chef.example/nascondini');
});
test('manual mismatch offers explicit replacement and never silently merges',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);mock.method(global,'fetch',async()=>new Response('<title>Pancakes</title><p>Full method here.</p>',{headers:{'Content-Type':'text/html'}}));
 const r=await importRecipe({source:'caption',captionDraft:partial,originalRecipeUrl:'https://chef.example/pancakes'}, {name:'groq',extract:async()=>({...complete,title:'Pancakes'})});
 assert.equal(r.status,'incomplete');assert.equal(r.draft.title,'Nascondini');assert.equal(r.replacementCandidate.draft.title,'Pancakes');
});
test('failed discovery and malformed candidate leave the original partial intact',async()=>{
 const provider={name:'groq',extract:async()=>partial};const r=await importRecipe({source:'no creator URL'},provider);assert.deepEqual(r.draft.ingredients,partial.ingredients);
});

test('multiple formulas return alternatives without discovery; selecting never combines ingredients',async()=>{
 const {inspectRatioEvidence}=require('../src/lib/extraction/ratio-evidence.ts');const {chooseAlternative}=require('../src/lib/recipes/import-review.ts');
 const text='Dark chocolate: 1 part chocolate : 1 part heavy cream\nMilk chocolate: 1.5 parts chocolate : 1 part heavy cream\nWhite chocolate: 2 parts chocolate : 1 part heavy cream';
 const extracted={title:'Ganache',ingredients:[],steps:[],completeness:'incomplete',missingFields:['instructions'],alternatives:inspectRatioEvidence(text).formulas.map((f,i)=>({...f,id:'formula-'+i,ingredients:f.ingredients.map((r,position)=>({...r,position}))}))};
 let calls=0;const r=await importRecipe({source:text},{name:'groq',extract:async()=>{calls++;return extracted}});assert.equal(calls,1);assert.equal(r.alternatives.length,3);assert.equal(r.draft.ingredients.length,0);assert.equal(r.selectedAlternativeId,null);assert.equal(r.draft.alternatives,undefined);
 const snapshot=JSON.stringify(r);for(let i=0;i<3;i++){const chosen=chooseAlternative(r,'formula-'+i);assert.equal(chosen.draft.ingredients.length,2);assert.equal(chosen.draft.ingredients[0].quantity,['1','1.5','2'][i]);assert.match(chosen.draft.title,new RegExp(r.alternatives[i].label));assert.equal(chosen.alternatives.length,3);}assert.equal(JSON.stringify(r),snapshot);assert.throws(()=>chooseAlternative(r,'no-such-id'));
 const selected=chooseAlternative(r,'formula-1');assert.equal(chooseAlternative(selected,'formula-2').draft.title,'Ganache — White chocolate');
});
