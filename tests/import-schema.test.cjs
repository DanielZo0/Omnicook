require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recipeSchema}=require('../src/lib/recipe-schema.ts');
const {editableRecipeSchema,importExtractionSchema}=require('../src/lib/extraction/import-schema.ts');
const {systemPromptFor}=require('../src/lib/extraction/prompt.ts');
const partial={title:'Nascondini',ingredients:[{position:0,name:'farina',quantity:'350',unit:'g'}],steps:[]};
test('partial extraction is recoverable but cannot be saved as a recipe',()=>{
 assert.equal(recipeSchema.safeParse(partial).success,false);
 assert.equal(editableRecipeSchema.safeParse({...partial,title:''}).success,true);
 assert.equal(importExtractionSchema.safeParse({...partial,completeness:'incomplete',missingFields:['instructions']}).success,true);
 assert.equal(importExtractionSchema.safeParse({...partial,completeness:'complete',missingFields:[]}).success,false);
 assert.equal(importExtractionSchema.safeParse({...partial,title:' ',completeness:'incomplete',missingFields:['instructions']}).success,false);
});
test('complete Italian method is accepted without English verbs',()=>{
 assert.equal(importExtractionSchema.safeParse({...partial,steps:[{position:0,instruction:'Impastate e infornate per 30 minuti.'}],completeness:'complete',missingFields:[]}).success,true);
 assert.match(systemPromptFor('import'),/incomplete/);
 assert.match(systemPromptFor('import'),/Never invent/);
});

test('import prompt permits unmeasured components and keeps dish attribution explicit',()=>{
 const prompt=systemPromptFor('import');
 assert.match(prompt,/Explicitly named food components are usable ingredients even without quantities/);
 assert.match(prompt,/only one dish has an explicit component list, extract that dish only/);
 assert.match(prompt,/two or more dishes have explicit ingredient lists, return.*insufficient_recipe_content/);
 assert.match(prompt,/Never infer ingredients from a dish name alone/);
 assert.match(prompt,/engagement counts are never ingredient quantities/);
 assert.doesNotMatch(systemPromptFor('recipe'),/only one dish has an explicit component list/);
});

test('final import refusal rule permits multiple distinct dishes',()=>{
 const prompt=systemPromptFor('import');
 assert.doesNotMatch(prompt,/Only if the source contains NO usable ingredients return/);
 assert.match(prompt,/Refuse only when there are no usable ingredients or when multiple dishes have explicit ingredient lists/);
 assert.doesNotMatch(prompt,/alternatives contract above/);
});

test('dish mentions are not counted as independent ingredient lists',()=>{
 const prompt=systemPromptFor('import');
 assert.match(prompt,/A component list includes ordinary prose such as/);
 assert.match(prompt,/A second dish name without its own components is NOT a second ingredient list/);
});

test('single-dish instruction preserves source measurements and actual method',()=>{
 const prompt=systemPromptFor('import');
 assert.doesNotMatch(prompt,/return that ingredient draft with unknown measurements/);
 assert.match(prompt,/preserve any supplied measurements and actual method/);
});
