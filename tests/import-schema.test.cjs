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
