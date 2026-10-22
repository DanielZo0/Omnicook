require('./register-ts.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createImportBudget}=require('../src/lib/extraction/import-budget.ts');
test('source and AI budgets are cumulative and requests bounded',async()=>{
 let now=0;const b=createImportBudget(()=>now);
 await b.runSource(async()=>{now+=18000;return 'caption'});
 await assert.rejects(b.runSource(async()=>''));
 const a=createImportBudget(()=>now);await a.runAI(async ms=>{assert.equal(ms,36000);now+=35000});
 await a.runAI(async ms=>{assert.equal(ms,1000);now+=1000});await assert.rejects(a.runAI(async()=>''));
 for(let i=0;i<5;i++)b.takeAdditionalRequest();assert.throws(()=>b.takeAdditionalRequest());
});
test('overall budget expires even between source and AI work',async()=>{let n=0;const b=createImportBudget(()=>n);n=54000;await assert.rejects(b.runAI(async()=>''));});

