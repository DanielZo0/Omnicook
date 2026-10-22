require('./register-ts.cjs');const {test,afterEach,mock}=require('node:test');const assert=require('node:assert/strict');const dns=require('node:dns/promises');
const {readSource}=require('../src/lib/extraction/fetch-source.ts');const {createImportBudget}=require('../src/lib/extraction/import-budget.ts');
afterEach(()=>mock.restoreAll());
test('actual import reader follows Pinterest original destination',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const pages={'https://www.pinterest.com/pin/123/':'<meta property="og:see_also" content="https://chef.example/stew">','https://chef.example/stew':'<script type="application/ld+json">{"@type":"Recipe","name":"Stew","recipeIngredient":["200 g potatoes"],"recipeInstructions":"Cook potatoes until soft."}</script>'};
 mock.method(global,'fetch',async u=>new Response(pages[String(u)]||'',{headers:{'Content-Type':'text/html'}}));
 const r=await readSource('https://www.pinterest.com/pin/123/',createImportBudget());assert.match(r.text,/200 g potatoes/);assert.equal(r.sourceUrl,'https://www.pinterest.com/pin/123/');
});
