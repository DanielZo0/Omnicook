require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeImageUrl}=require('../src/lib/image-url.ts');
test('private recipe photo paths render without permitting arbitrary relative URLs',()=>{
 assert.equal(normalizeImageUrl('/api/recipes/00000000-0000-4000-8000-000000000001/photo?v=123'),'/api/recipes/00000000-0000-4000-8000-000000000001/photo?v=123');
 for(const path of ['/api/auth/get-session','//evil.example/pic','/api/recipes/no-id/photo','/api/recipes/00000000-0000-4000-8000-000000000001/photo?redirect=https://evil.example'])assert.equal(normalizeImageUrl(path),null);
});
