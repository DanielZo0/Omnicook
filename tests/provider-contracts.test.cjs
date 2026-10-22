require('./register-ts.cjs');const {test}=require('node:test'),assert=require('node:assert/strict');
const {sourceKey,foodRecordSchema,sourcedRecipeSchema}=require('../src/lib/nutrition/types.ts');
test('provider identity prevents collisions and contracts reject malformed sources',()=>{
 assert.notEqual(sourceKey({providerId:'a',externalId:'123',normalizationVersion:'1'}),sourceKey({providerId:'b',externalId:'123',normalizationVersion:'1'}));
 assert.notEqual(sourceKey({providerId:'a',externalId:'123',normalizationVersion:'1'}),sourceKey({providerId:'a',externalId:'123',normalizationVersion:'2'}));
 assert.equal(foodRecordSchema.safeParse({}).success,false);assert.equal(sourcedRecipeSchema.safeParse({source:{sourceUrl:'http://127.0.0.1'}}).success,false);
});
