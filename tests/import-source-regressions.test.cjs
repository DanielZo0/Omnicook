require('./register-ts.cjs');const {test,afterEach,mock}=require('node:test');const assert=require('node:assert/strict');const dns=require('node:dns/promises');
const {readSource}=require('../src/lib/extraction/fetch-source.ts');const {createImportBudget}=require('../src/lib/extraction/import-budget.ts');
afterEach(()=>mock.restoreAll());
test('actual import reader follows Pinterest original destination',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const pages={'https://www.pinterest.com/pin/123/':'<meta property="og:see_also" content="https://chef.example/stew">','https://chef.example/stew':'<script type="application/ld+json">{"@type":"Recipe","name":"Stew","recipeIngredient":["200 g potatoes"],"recipeInstructions":"Cook potatoes until soft."}</script>'};
 mock.method(global,'fetch',async u=>new Response(pages[String(u)]||'',{headers:{'Content-Type':'text/html'}}));
 const r=await readSource('https://www.pinterest.com/pin/123/',createImportBudget());assert.match(r.text,/200 g potatoes/);assert.equal(r.sourceUrl,'https://www.pinterest.com/pin/123/');
});

test('actual reader and import preserve formula alternatives for canonical and tracked reel URLs',async()=>{
 const {importRecipe}=require('../src/lib/extraction/import-recipe.ts');const {withValidationRepair}=require('../src/lib/extraction/provider.ts');const {inspectRatioEvidence}=require('../src/lib/extraction/ratio-evidence.ts');
 const caption='Dark chocolate: 1 part chocolate : 1 part heavy cream\nMilk chocolate: 1.5 parts chocolate : 1 part heavy cream\nWhite chocolate: 2 parts chocolate : 1 part heavy cream\nOriginal www.chef.example';
 const extraction={title:'Ganache',ingredients:[],steps:[],completeness:'incomplete',missingFields:['instructions'],alternatives:inspectRatioEvidence(caption).formulas.map((f,i)=>({...f,id:'formula-'+i,ingredients:f.ingredients.map((r,position)=>({...r,position}))}))};
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);let requests=[];
 mock.method(global,'fetch',async u=>{requests.push(String(u));return new Response('<script type="application/json">'+JSON.stringify({items:[{code:'DbjTvK6p8fB',caption:{text:caption}},{code:'unrelated',caption:{text:'Unrelated recipe'}}]})+'</script>',{headers:{'Content-Type':'text/html'}})});
 for(const suffix of ['', '?psln=tracking']){let calls=0;const source='https://www.instagram.com/reel/DbjTvK6p8fB/'+suffix;const r=await importRecipe({source},withValidationRepair({name:'groq',extract:async()=>{calls++;return extraction}}));assert.equal(r.status,'incomplete');assert.equal(r.alternatives.length,3);assert.equal(r.sourceUrl,source);assert.equal(r.draft.steps.length,0);assert.equal(r.draft.ingredients.length,0);assert.equal(calls,1);}
 assert.equal(requests.length,2);assert.ok(requests.every(u=>u.includes('instagram.com')));
});
