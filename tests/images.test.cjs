require('./register-ts.cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {vaultToMobile} = require('../src/lib/mobile/adapters.ts');
const {normalizeImageUrl} = require('../src/lib/image-url.ts');
const recipe = {id: 'test', title: 'Tomato pasta', category: 'Dinner', ingredients: [], steps: [], servings: 2};
test('saved source photo represents the recipe instead of random stock photography', () => {
  assert.equal(vaultToMobile({...recipe, imageUrl: 'https://food.example/pasta.jpg'}).img, 'https://food.example/pasta.jpg');
});
test('missing or unsafe recipe images use a neutral placeholder', () => {
  assert.equal(vaultToMobile(recipe).img, '/recipe-placeholder.svg');
  assert.equal(vaultToMobile({...recipe, imageUrl: 'javascript:alert(1)'}).img, '/recipe-placeholder.svg');
});
test('relative source images resolve against the source page', () => {
  assert.equal(normalizeImageUrl('/pasta.jpg', 'https://food.example/recipe'), 'https://food.example/pasta.jpg');
});
test('private, credentialed and non-HTTP image URLs are rejected', () => {
  for (const url of ['http://127.0.0.1/photo', 'http://10.0.0.1/photo', 'http://192.168.1.1/photo', 'https://user:password@food.example/photo', 'data:image/png;base64,abc', 'javascript:alert(1)']) assert.equal(normalizeImageUrl(url), null);
});
