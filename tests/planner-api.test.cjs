require('./register-ts.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {entryRequestSchema,preferencesSchema}=require('../src/lib/planner/schemas.ts');
test('planner rejects malformed dates, foreign source payloads and invalid portions',()=>{
 const entry={recipeId:'11111111-1111-4111-8111-111111111111',plannedFor:'2026-10-22',mealSlot:'dinner',expectedRevision:0,servings:1};
 assert.equal(entryRequestSchema.safeParse(entry).success,true);
 for(const change of [{plannedFor:'2026-02-30'},{servings:0},{servings:Infinity},{mealSlot:'supper'},{expectedRevision:-1},{snapshotId:'x'}])assert.equal(entryRequestSchema.safeParse({...entry,...change}).success,false);
 assert.equal(preferencesSchema.safeParse({}).success,true);
 assert.equal(preferencesSchema.safeParse({kcalTarget:0}).success,false);
 assert.equal(preferencesSchema.safeParse({enabledSlots:[]}).success,false);
});
