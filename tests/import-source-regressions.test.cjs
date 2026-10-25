require('./register-ts.cjs');const {test,afterEach,mock}=require('node:test');const assert=require('node:assert/strict');const dns=require('node:dns/promises');
const {readSource}=require('../src/lib/extraction/fetch-source.ts');const {createImportBudget}=require('../src/lib/extraction/import-budget.ts');
afterEach(()=>mock.restoreAll());
test('actual import reader follows Pinterest original destination',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const pages={'https://www.pinterest.com/pin/123/':'<meta property="og:see_also" content="https://chef.example/stew">','https://chef.example/stew':'<script type="application/ld+json">{"@type":"Recipe","name":"Stew","recipeIngredient":["200 g potatoes"],"recipeInstructions":"Cook potatoes until soft."}</script>'};
 mock.method(global,'fetch',async u=>new Response(pages[String(u)]||'',{headers:{'Content-Type':'text/html'}}));
 const r=await readSource('https://www.pinterest.com/pin/123/',createImportBudget());assert.match(r.text,/200 g potatoes/);assert.equal(r.sourceUrl,'https://www.pinterest.com/pin/123/');
});

const facebookSummary='Two dishes in Greece: Greek salad and phyllo pastry with feta, honey and sesame.';
function facebookHtml(description=facebookSummary) {
 return `<title>1.5M views and 4.6K reactions</title>${description===null?'':`<meta property="og:description" content="${description}">`}<meta property="og:image" content="https://images.example/pastry.jpg"><p>Unrelated recipe: 500 g sugar. Bake for 20 minutes.</p><script type="application/ld+json">{"@type":"Recipe","name":"Unrelated cake","recipeIngredient":["500 g sugar"],"recipeInstructions":"Bake the cake.","image":"https://images.example/unrelated.jpg"}</script>`;
}
test('Facebook share redirect uses only requested metadata, excluding related Recipe and engagement',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const final='https://www.facebook.com/creator/videos/1112931391428022/';
 mock.method(global,'fetch',async u=>String(u).includes('/share/')?new Response(null,{status:302,headers:{location:final}}):new Response(facebookHtml(),{headers:{'Content-Type':'text/html'}}));
 const result=await readSource('https://www.facebook.com/share/r/151oVZayj5f/',createImportBudget());
 assert.equal(result.text,facebookSummary);assert.equal(result.sourceUrl,final);
 assert.equal(result.page.structuredText,'');assert.equal(result.page.caption,'');
 assert.equal(result.imageUrl,'https://images.example/pastry.jpg');
});
test('Facebook metadata works through the legacy resolver without requiring a method',async()=>{
 const {resolveSource}=require('../src/lib/extraction/fetch-source.ts');
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 mock.method(global,'fetch',async()=>new Response(facebookHtml(),{headers:{'Content-Type':'text/html'}}));
 const result=await resolveSource('https://m.facebook.com/reel/1112931391428022/');
 assert.equal(result.text,facebookSummary);
});
test('Facebook missing, short or login-only metadata rejects before calling AI',async()=>{
 const {importRecipe}=require('../src/lib/extraction/import-recipe.ts');
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 for(const description of [null,'Facebook','Allow all cookies on Facebook to continue using this website and its social features.','Log into Facebook to start sharing and connecting with your friends, family, and people you know.','You must log in to continue. Sign up for Facebook to connect with friends and family.']){
  mock.method(global,'fetch',async()=>new Response(facebookHtml(description),{headers:{'Content-Type':'text/html'}}));
  let calls=0;
  await assert.rejects(importRecipe({source:'https://www.facebook.com/reel/123/'},{name:'groq',extract:async()=>{calls++;return {error:'insufficient_recipe_content'}}}),/cannot be read/);
  assert.equal(calls,0);
 }
});
test('Facebook lookalike stays generic; private redirect remains rejected',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 mock.method(global,'fetch',async()=>new Response('<title>Example</title><p>300 g beans. Mix and cook.</p>',{headers:{'Content-Type':'text/html'}}));
 const generic=await readSource('https://facebook.com.example/recipe',createImportBudget());assert.match(generic.text,/300 g beans/);
 mock.method(global,'fetch',async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}}));
 await assert.rejects(readSource('https://www.facebook.com/share/r/123/',createImportBudget()),/Only public/);
});

test('Facebook cookie cooling instructions are recipe content rather than consent',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const description='Allow cookies to cool before serving. Ingredients: 200 g flour, 100 g butter, 80 g sugar. Mix and bake.';
 mock.method(global,'fetch',async()=>new Response(facebookHtml(description),{headers:{'Content-Type':'text/html'}}));
 const result=await readSource('https://www.facebook.com/reel/123/',createImportBudget());assert.equal(result.text,description);
});
