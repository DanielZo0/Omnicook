require('./register-ts.cjs');
const {test,afterEach,mock}=require('node:test');const assert=require('node:assert/strict');
const dns=require('node:dns/promises');
const {readSource}=require('../src/lib/extraction/fetch-source.ts');
const {discoverOriginal}=require('../src/lib/extraction/discover-original.ts');
const {createImportBudget}=require('../src/lib/extraction/import-budget.ts');
afterEach(()=>mock.restoreAll());
test('creator homepage search discovers recipe without guessing endpoints',async()=>{
 const visited=[];mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);
 const pages={'https://www.instagram.com/p/abc/':'<meta property="og:description" content="Nascondini: 350 g farina, 140 g burro, 80 ml latte. Ricetta su www.chef.example">','https://www.chef.example/':'<form action="/find" method="get"><input type="search" name="s"></form>','https://www.chef.example/find?s=Nascondini':'<a href="/nascondini">Nascondini</a><a href="https://evil.example/">Nascondini</a>','https://www.chef.example/nascondini':'<title>Nascondini</title><p>350 g farina, 140 g burro, 80 ml latte. Impastate poi infornate per 30 minuti.</p>'};
 mock.method(global,'fetch',async u=>{visited.push(String(u));assert.ok(pages[String(u)],String(u));return new Response(pages[String(u)],{headers:{'Content-Type':'text/html'}})});
 const b=createImportBudget();const source=await readSource('https://www.instagram.com/p/abc/',b);
 const candidates=await discoverOriginal(source,'Nascondini',b);
 assert.equal(candidates.length,1);assert.equal(candidates[0].sourceUrl,'https://www.chef.example/nascondini');assert.equal(visited.length,4);
});
test('creator redirects cannot leave its origin or access private targets',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);let calls=0;
 mock.method(global,'fetch',async()=>{calls++;return new Response('',{status:302,headers:{Location:'http://127.0.0.1/private'}})});
 const found=await discoverOriginal({sourceUrl:'https://instagram.com/p/a/',text:'Ricetta Nascondini www.chef.example',page:null,imageUrl:null},'Nascondini',createImportBudget());
 assert.equal(found.length,0);assert.equal(calls,1);
});
test('all explicitly linked originals are evaluated rather than selecting first',async()=>{
 mock.method(dns,'lookup',async()=>[{address:'93.184.215.14',family:4}]);const visited=[];
 mock.method(global,'fetch',async u=>{visited.push(String(u));return new Response('<title>Nascondini</title><p>350 g farina. Impastate e infornate.</p>',{headers:{'Content-Type':'text/html'}})});
 const found=await discoverOriginal({sourceUrl:null,imageUrl:null,page:null,text:'Ricette https://chef.example/a e https://chef.example/b'},'Nascondini',createImportBudget());
 assert.equal(found.length,2);assert.equal(visited.length,2);
});
