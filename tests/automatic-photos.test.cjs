require('./register-ts.cjs');
const {test, afterEach, mock} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dns = require('node:dns/promises');
const sharp = require('sharp');
const photo = fs.existsSync('src/lib/photos/automatic.ts') ? require('../src/lib/photos/automatic.ts') : {};
const previous = {GROQ_API_KEY:process.env.GROQ_API_KEY,NVIDIA_API_KEY:process.env.NVIDIA_API_KEY};
afterEach(() => {mock.restoreAll();for(const [k,v] of Object.entries(previous)) {if(v===undefined)delete process.env[k];else process.env[k]=v;}});
const recipe = {title:'Banana oat pancakes',ingredients:[{name:'banana'},{name:'oats'},{name:'egg'}],steps:[{instruction:'Mash banana, mix batter and fry pancakes.'}]};
async function png() {return sharp({create:{width:8,height:8,channels:3,background:'#edb85e'}}).png().toBuffer();}
function publicDns() {mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);}
function apiMock(handler) {
 process.env.GROQ_API_KEY='test-key';process.env.NVIDIA_API_KEY='test-key';publicDns();
 mock.method(global,'fetch',handler);
}
test('a valid source image is stored without substituting a generated picture', async()=>{
 assert.equal(typeof photo.resolveAutomaticPhoto,'function');
 const bytes=await png();
 apiMock(async url=>{assert.equal(String(url),'https://food.example/pancakes.png');return new Response(bytes,{headers:{'Content-Type':'image/png'}});});
 const result=await photo.resolveAutomaticPhoto(recipe,'https://food.example/pancakes.png');
 assert.equal(result.metadata.kind,'source');
 assert.equal((await sharp(result.data).metadata()).format,'webp');
});
test('an unrelated licensed candidate is rejected and the fallback image is generated from the recipe',async()=>{
 assert.equal(typeof photo.resolveAutomaticPhoto,'function');
 const bytes=await png();
 apiMock(async(url,init)=>{
  if(String(url).includes('commons.wikimedia.org'))return Response.json({query:{pages:{'1':{pageid:1,title:'File:Steak.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/steak.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Steak.jpg',extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},Artist:{value:'A Cook'},ImageDescription:{value:'Beef steak'}}}]}}}});
  if(String(url).includes('api.groq.com'))return Response.json({choices:[{message:{content:JSON.stringify({id:null,confidence:0})}}]});
  assert(String(url).includes('/flux.2-klein-4b'));
  const prompt=JSON.parse(init.body).prompt;assert(prompt.includes('banana'));assert(prompt.includes('oats'));assert(prompt.includes('fry pancakes'));
  return Response.json({artifacts:[{base64:bytes.toString('base64'),finishReason:'SUCCESS'}]});
 });
 const result=await photo.resolveAutomaticPhoto(recipe,null);
 assert.equal(result.metadata.kind,'generated');assert(result.data.length>0);
});
test('a matching openly licensed image keeps its attribution when stored',async()=>{
 assert.equal(typeof photo.resolveAutomaticPhoto,'function');
 const bytes=await png();
 apiMock(async url=>{
  if(String(url).includes('commons.wikimedia.org'))return Response.json({query:{pages:{'7':{pageid:7,title:'File:Banana oat pancakes.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/pancakes.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Pancakes.jpg',extmetadata:{LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'},Artist:{value:'<a href="x">Jane Cook</a>'},ImageDescription:{value:'Banana oat pancakes'}}}]}}}});
  if(String(url).includes('api.groq.com'))return Response.json({choices:[{message:{content:JSON.stringify({id:7,confidence:0.96})}}]});
  assert.equal(String(url),'https://upload.wikimedia.org/pancakes.jpg');return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});
 });
 const result=await photo.resolveAutomaticPhoto(recipe,null);
 assert.equal(result.metadata.kind,'lookup');assert.equal(result.metadata.credit,'Jane Cook');assert.equal(result.metadata.license,'CC BY 4.0');
});
test('private source URLs are never fetched',async()=>{
 assert.equal(typeof photo.resolveAutomaticPhoto,'function');
 delete process.env.GROQ_API_KEY;delete process.env.NVIDIA_API_KEY;
 mock.method(global,'fetch',async url=>{assert(String(url).includes('commons.wikimedia.org'));return Response.json({query:{pages:{}}});});
 assert.equal(await photo.resolveAutomaticPhoto(recipe,'http://127.0.0.1/private'),null);
});
test('unavailable image providers leave the recipe without an invented URL',async()=>{
 assert.equal(typeof photo.resolveAutomaticPhoto,'function');
 apiMock(async()=>{throw new Error('Provider unavailable');});
 assert.equal(await photo.resolveAutomaticPhoto(recipe,null),null);
});
test('image decoding rejects disguised SVG and oversized input',async()=>{
 const normalize=fs.existsSync('src/lib/photos/normalize.ts') ? require('../src/lib/photos/normalize.ts').normalizePhoto : undefined;
 assert.equal(typeof normalize,'function');
 await assert.rejects(normalize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),/photo|image/i);
 await assert.rejects(normalize(Buffer.alloc(4_000_001)),/large/i);
});

test('a queued NVIDIA image request is polled before its generated photo is accepted',async()=>{
 const bytes=await png();
 apiMock(async(url,init)=>{
  if(String(url).includes('commons.wikimedia.org'))return Response.json({query:{pages:{}}});
  if(String(url).includes('/flux.2-klein-4b'))return new Response('{}',{status:202,headers:{'NVCF-REQID':'00000000-0000-4000-8000-000000000001'}});
  assert.equal(String(url),'https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/00000000-0000-4000-8000-000000000001');
  return Response.json({artifacts:[{base64:bytes.toString('base64'),finishReason:'SUCCESS'}]});
 });
 const result=await photo.resolveAutomaticPhoto(recipe,null);
 assert.equal(result?.metadata.kind,'generated');
});

test('licensed-photo ranking works with a configured non-reasoning Groq model',async()=>{
 const previousModel=process.env.GROQ_MODEL;process.env.GROQ_MODEL='llama-3.3-70b-versatile';
 const bytes=await png();
 apiMock(async(url,init)=>{
  if(String(url).includes('commons.wikimedia.org'))return Response.json({query:{pages:{'7':{pageid:7,title:'File:Banana oat pancakes.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/pancakes.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Pancakes.jpg',extmetadata:{LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'},Artist:{value:'Jane Cook'},ImageDescription:{value:'Banana oat pancakes'}}}]}}}});
  if(String(url).includes('api.groq.com')) {
   if('reasoning_effort' in JSON.parse(init.body)) return new Response('{}',{status:400});
   return Response.json({choices:[{message:{content:JSON.stringify({id:7,confidence:0.96})}}]});
  }
  if(String(url).includes('upload.wikimedia.org'))return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});
  return new Response('{}',{status:503});
 });
 try {assert.equal((await photo.resolveAutomaticPhoto(recipe,null))?.metadata.kind,'lookup');}
 finally {if(previousModel===undefined)delete process.env.GROQ_MODEL;else process.env.GROQ_MODEL=previousModel;}
});
test('serving counts and unchanged edits keep an existing automatic photo',()=>{
 const changed=fs.existsSync('src/lib/photos/policy.ts') ? require('../src/lib/photos/policy.ts').photoRecipeChanged : undefined;
 assert.equal(typeof changed,'function');
 assert.equal(changed(recipe,{...recipe,servings:8,ingredients:recipe.ingredients.map(i=>({...i,quantity:'4'}))}),false);
 assert.equal(changed(recipe,{...recipe,title:'Chicken curry'}),true);
 assert.equal(changed(recipe,{...recipe,ingredients:[{name:'chicken'}]}),true);
});

test('dish lookup can find a finished-dish photo when descriptive title words are absent from the image index',async()=>{
 const bytes=await png();
 apiMock(async(url,init)=>{
  if(String(url).includes('commons.wikimedia.org')) {
   const query=new URL(String(url)).searchParams.get('gsrsearch');
   if(!query.includes(' OR '))return Response.json({query:{pages:{}}});
   return Response.json({query:{pages:{'7':{pageid:7,title:'File:Bruschetta.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/bruschetta.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Bruschetta.jpg',extmetadata:{LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'},Artist:{value:'Jane Cook'},ImageDescription:{value:'Bruschetta with chopped tomatoes and basil'}}}]}}}});
  }
  if(String(url).includes('api.groq.com'))return Response.json({choices:[{message:{content:JSON.stringify({id:7,confidence:0.96})}}]});
  if(String(url).includes('upload.wikimedia.org'))return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});
  return new Response('{}',{status:503});
 });
 const result=await photo.resolveAutomaticPhoto({title:'Tomato basil bruschetta',ingredients:[{name:'tomatoes'},{name:'basil'},{name:'bread'}],steps:[{instruction:'Toast bread and top with dressed tomatoes and basil.'}]},null);
 assert.equal(result?.metadata.kind,'lookup');
});

test('image generation uses the validated live FLUX Klein schema rather than its stale documentation defaults',async()=>{
 const bytes=await png();
 apiMock(async(url,init)=>{
  if(String(url).includes('commons.wikimedia.org'))return Response.json({query:{pages:{}}});
  const request=JSON.parse(init.body);
  if(!String(url).endsWith('/flux.2-klein-4b') || request.cfg_scale<1 || 'mode' in request)return new Response('{}',{status:422});
  return Response.json({artifacts:[{base64:bytes.toString('base64'),finishReason:'SUCCESS'}]});
 });
 assert.equal((await photo.resolveAutomaticPhoto(recipe,null))?.metadata.kind,'generated');
});

test('failed photo jobs retry after a day and stop after three attempts',()=>{
 const needs= require('../src/lib/photos/policy.ts').photoNeedsWork;
 assert.equal(typeof needs,'function');
 const failed={kind:null,status:'unavailable',attempts:1,retryAfter:'2026-10-15T10:00:00Z'};
 assert.equal(needs(failed,Date.parse('2026-10-15T09:00:00Z')),false);
 assert.equal(needs(failed,Date.parse('2026-10-15T11:00:00Z')),true);
 assert.equal(needs({...failed,attempts:3},Date.parse('2026-10-15T11:00:00Z')),false);
 assert.equal(needs({kind:'user',status:'ready'},Date.parse('2026-10-15T11:00:00Z')),false);
});
