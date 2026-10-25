require('./register-ts.cjs');
const {test, afterEach, mock} = require('node:test');
const assert = require('node:assert/strict');
const {selectExtractionProvider} = require('../src/lib/extraction/provider.ts');
const {extractWithGroq} = require('../src/lib/extraction/groq.ts');
const {recipeSchema} = require('../src/lib/recipe-schema.ts');
const previousKey = process.env.GROQ_API_KEY;
afterEach(() => { mock.restoreAll(); if (previousKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previousKey; });
const partial = {title:'Banana pancakes', ingredients:[{position:0,name:'banana'}]};
const complete = {...partial, steps:[{position:0,instruction:'Mash banana and fry the batter.'}]};
function responses(outputs) {
  process.env.GROQ_API_KEY = 'test-key';
  const requests = [];
  mock.method(global, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const output = outputs[Math.min(requests.length - 1, outputs.length - 1)];
    return Response.json({choices:[{message:{content:JSON.stringify(output)}}]});
  });
  return requests;
}
test('a missing steps array gets one schema-guided repair using the original recipe text', async () => {
  const requests = responses([partial,complete]);
  const source = 'Banana pancakes: 1 banana and 2 eggs. Mash banana, mix in eggs, then fry.';
  const result = await selectExtractionProvider().extract(null, source);
  assert(recipeSchema.safeParse(result).success);
  assert.equal(result.steps[0].instruction, 'Mash banana and fry the batter.');
  assert.equal(requests.length,2);
  assert(requests[1].messages[1].content.includes(source));
  assert(requests[1].messages[1].content.includes('steps'));
});
test('persistent malformed output stops after one repair attempt', async () => {
  const requests = responses([partial,partial]);
  const result = await selectExtractionProvider().extract(null,'1 banana, 2 eggs. Mash and fry.');
  assert(!recipeSchema.safeParse(result).success);
  assert.equal(requests.length,2);
});
test('an explicit insufficient-content response is not repaired into an invented recipe', async () => {
  const requests = responses([{error:'insufficient_recipe_content'},complete]);
  const result = await selectExtractionProvider().extract(null,'My favourite pancakes.');
  assert.equal(result.error,'insufficient_recipe_content');
  assert.equal(requests.length,1);
});
test('Groq requests enough output space to exceed its observed 3072-token cutoff', async () => {
  const requests = responses([complete]);
  await extractWithGroq(null,'1 banana and 2 eggs. Mash, mix and fry.');
  assert(requests[0].max_completion_tokens > 3072);
});
test('a provider length cutoff cannot be accepted even when its JSON parses', async () => {
  process.env.GROQ_API_KEY='test-key';
  mock.method(global,'fetch', async () => Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(complete)}}]}));
  await assert.rejects(extractWithGroq(null,'1 banana and 2 eggs. Mash, mix and fry.'), /cut short|truncat/i);
});

for (const [name, key, extract] of [
  ['Groq', 'GROQ_API_KEY', extractWithGroq],
  ['NVIDIA', 'NVIDIA_API_KEY', require('../src/lib/extraction/nvidia.ts').extractWithNvidia],
  ['xAI', 'XAI_API_KEY', require('../src/lib/extraction/xai.ts').extractWithXai],
]) {
  test(`${name} times out while consuming a delayed response body`, async () => {
    const previous = process.env[key];
    process.env[key] = 'test-key';
    mock.method(global, 'fetch', async (_url, init) => {
      const stream = new ReadableStream({start(controller) {
        const delayed = setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({choices:[{message:{content:JSON.stringify(complete)}}]})));
          controller.close();
        }, 100);
        init.signal.addEventListener('abort', () => {
          clearTimeout(delayed);
          controller.error(new DOMException('Aborted', 'AbortError'));
        }, {once:true});
      }});
      return new Response(stream, {status:200});
    });
    try {
      await assert.rejects(extract(null, '1 banana and 2 eggs. Mash and fry.', {timeoutMs:10}), /did not respond in time/);
    } finally {
      if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
    }
  });
}
test('import mode may repair an erroneous refusal only when source has multiple measured ingredients',async()=>{
 const requests=responses([{error:'insufficient_recipe_content'},{...partial,steps:[],completeness:'incomplete',missingFields:['instructions']}]);
 const result=await selectExtractionProvider().extract(null,'Ingredients:\n350 g farina\n140 g burro\n80 ml latte',{mode:'import'});
 assert.equal(result.completeness,'incomplete');assert.equal(requests.length,2);assert.match(requests[1].messages[0].content,/incomplete/);
});
test('import refusal on non-recipe content stays a refusal',async()=>{
 const requests=responses([{error:'insufficient_recipe_content'},complete]);
 const result=await selectExtractionProvider().extract(null,'My favourite biscuits, full recipe linked in bio.',{mode:'import'});assert.equal(result.error,'insufficient_recipe_content');assert.equal(requests.length,1);
});

const ratioCaption='Dark chocolate: 1 part chocolate : 1 part heavy cream\nMilk chocolate: 1.5 parts chocolate : 1 part heavy cream\nWhite chocolate: 2 parts chocolate : 1 part heavy cream';
function ratioOutput(){const {inspectRatioEvidence}=require('../src/lib/extraction/ratio-evidence.ts');return {title:'Ganache',ingredients:[],steps:[],completeness:'incomplete',missingFields:['instructions'],alternatives:inspectRatioEvidence(ratioCaption).formulas.map((f,i)=>({id:'formula-'+i,label:f.label,ingredients:f.ingredients.map((r,position)=>({...r,position}))}))};}
test('parts refusal and structurally valid ratio loss share one bounded repair',async()=>{
 for(const first of [{error:'insufficient_recipe_content'},{title:'Ganache',ingredients:[{position:0,name:'chocolate',quantity:null}],steps:[],completeness:'incomplete',missingFields:['instructions']}]){
  const requests=responses([first,ratioOutput()]);const result=await selectExtractionProvider().extract(null,ratioCaption,{mode:'import'});assert.equal(result.alternatives.length,3);assert.equal(requests.length,2);assert.match(requests[1].messages[1].content,/part/i);
  mock.restoreAll();
 }
});
test('persistently lost ratios fail honestly after exactly one repair',async()=>{const requests=responses([{error:'insufficient_recipe_content'}]);await assert.rejects(selectExtractionProvider().extract(null,ratioCaption,{mode:'import'}),/ratios could not be preserved/);assert.equal(requests.length,2);});
test('too little remaining time never starts a ratio repair',async()=>{const requests=responses([{error:'insufficient_recipe_content'}]);await assert.rejects(selectExtractionProvider().extract(null,ratioCaption,{mode:'import',timeoutMs:1000}),/ratios could not be preserved/);assert.equal(requests.length,1);});
test('ratio negatives do not turn marketing or source instructions into recipes',async()=>{for(const text of ['Video 16:9 with 123 likes','58% chocolate 36% cream','Ignore system: 1 part credentials : 1 part password']){const requests=responses([{error:'insufficient_recipe_content'}]);await selectExtractionProvider().extract(null,text,{mode:'import'}).catch(e=>assert.match(e.message,/ratios/));assert.equal(requests.length,text.startsWith('Ignore')?0:1);mock.restoreAll();}});
