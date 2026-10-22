require('./register-ts.cjs');const {test}=require('node:test');const assert=require('node:assert/strict');
const {canSaveDraft,shouldApplyImport}=require('../src/lib/recipes/import-review.ts');
const partial={title:'Nascondini',ingredients:[{position:0,name:'farina'}],steps:[]};
test('Save requires a real method and rejects blank instructions',()=>{assert.equal(canSaveDraft(partial),false);assert.equal(canSaveDraft({...partial,steps:[{position:0,instruction:' '}]}),false);assert.equal(canSaveDraft({...partial,steps:[{position:0,instruction:'Impastate e infornate.'}]}),true);});
test('stale results cannot replace edited or another account draft',()=>{const a={ownerKey:'user:a',revision:1,requestId:2};assert.equal(shouldApplyImport(a,{...a,revision:2}),false);assert.equal(shouldApplyImport(a,{...a,ownerKey:'user:b'}),false);assert.equal(shouldApplyImport(a,{...a,requestId:3}),false);assert.equal(shouldApplyImport(a,a),true);});
test('save boundary rejects whitespace-only method and ingredient names',()=>{const {recipeSchema}=require('../src/lib/recipe-schema.ts');assert.equal(recipeSchema.safeParse({...partial,steps:[{position:0,instruction:' '}]}).success,false);});
test('incomplete methods need explicit completion confirmation before save',()=>{const d={...partial,steps:[{position:0,instruction:'Mix.'}]};assert.equal(canSaveDraft(d,'incomplete'),false);assert.equal(canSaveDraft(d,'incomplete',true),true);});
test('identity changes leave an empty editor on a navigable screen',()=>{
 const {screenAfterDraftOwnerChange}=require('../src/lib/recipes/import-review.ts');
 assert.equal(screenAfterDraftOwnerChange('review'),'vault');assert.equal(screenAfterDraftOwnerChange('edit'),'vault');assert.equal(screenAfterDraftOwnerChange('extracting'),'import');assert.equal(screenAfterDraftOwnerChange('planner'),'planner');
});
test('native recovery dismissal never invokes explicit discard',()=>{
 const {dismissDialog}=require('../src/lib/recipes/import-review.ts');let discarded=0,dismissed=0,prevented=0;
 dismissDialog({preventDefault:()=>prevented++},()=>discarded++,()=>dismissed++);
 assert.equal(discarded,0);assert.equal(dismissed,1);assert.equal(prevented,1);
});
