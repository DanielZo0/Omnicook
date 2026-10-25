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

test('Facebook current reader supplies only summary and preserves unknown amounts and missing method',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const source='https://www.facebook.com/creator/videos/1112931391428022/';
 const summary='Two dishes in Greece: Greek salad and phyllo pastry with feta, honey and sesame.';
 mock.method(global,'fetch',async()=>new Response(`<title>1.5M views and 4.6K reactions</title><meta property="og:description" content="${summary}"><p>Unrelated salad: tomatoes and cucumber.</p>`,{headers:{'Content-Type':'text/html'}}));
 let calls=0;
 const r=await importRecipe({source},{name:'groq',extract:async(url,text,options)=>{
  calls++;assert.equal(url,source);assert.equal(text,summary);assert.equal(options.mode,'import');
  return {title:'phyllo pastry with feta, honey and sesame',ingredients:['phyllo pastry','feta','honey','sesame'].map((name,position)=>({name,position,quantity:null,unit:null})),steps:[],completeness:'incomplete',missingFields:['instructions']};
 }});
 assert.equal(calls,1);assert.equal(r.sourceUrl,source);assert.equal(r.status,'incomplete');assert.deepEqual(r.missingFields,['instructions']);
 assert.deepEqual(r.draft.ingredients.map(i=>i.name),['phyllo pastry','feta','honey','sesame']);
 assert.ok(r.draft.ingredients.every(i=>i.quantity===null&&i.unit===null));assert.deepEqual(r.draft.steps,[]);
 assert.equal(r.alternatives,undefined);assert.equal(r.draft.servings,null);
});
test('unmeasured Facebook refusal stays fail-closed without broader repair',async()=>{
 const {withValidationRepair}=require('../src/lib/extraction/provider.ts');
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 mock.method(global,'fetch',async()=>new Response('<meta property="og:description" content="Two dishes in Greece: Greek salad and phyllo pastry with feta, honey and sesame.">',{headers:{'Content-Type':'text/html'}}));
 let calls=0;
 await assert.rejects(importRecipe({source:'https://www.facebook.com/reel/123/'},withValidationRepair({name:'groq',extract:async()=>{calls++;return {error:'insufficient_recipe_content'}}})),/No usable recipe ingredients/);
 assert.equal(calls,1);
});
