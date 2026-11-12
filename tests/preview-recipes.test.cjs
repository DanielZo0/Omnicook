require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mobileToPlannable } = require('../src/lib/planner/mobile.ts');
const { buildShoppingList } = require('../src/lib/shopping/build-list.ts');
const sample = { id: 9, title: 'Test recipe', author: 'You', cuisine: '', time: null, yieldServings: 2, image: '/recipe-placeholder.svg', note: '', likes: 0, own: true };

test('preview range and fraction quantities scale consistently into Shopping', () => {
  const { previewToMobile } = require('../src/app/social-preview/recipe-model.ts');
  const mobile = previewToMobile(sample, ['2-3 tomatoes', '1 1/2 cups rice', '½ tsp salt', '0.5 kg flour', 'A handful of parsley'], ['Mix.']);
  const recipe = mobileToPlannable(mobile);
  const rows = buildShoppingList([{id:'meal', servings:4, recipe}]);
  assert.deepEqual(rows.map(r => [r.name, r.amounts[0].quantity, r.amounts[0].unit]), [
    ['tomatoes', '4–6', ''], ['rice', '3', 'cup'], ['salt', '1', 'tsp'], ['flour', '1', 'kg'], ['A handful of parsley', null, ''],
  ]);
  assert.equal(recipe.servings, 2);
  assert.equal(rows[0].amounts[0].unknownYield, false);
});

test('preview adapter keeps unset time unknown and preserves entered duration and yield', () => {
  const { previewToMobile } = require('../src/app/social-preview/recipe-model.ts');
  const unknown = mobileToPlannable(previewToMobile(sample, ['100 g rice'], ['Cook.']));
  assert.equal(unknown.prepMinutes, null);
  assert.equal(unknown.cookMinutes, null);
  const known = mobileToPlannable(previewToMobile({...sample, time:35, yieldServings:6}, ['100 g rice'], ['Cook.']));
  assert.equal(known.prepMinutes + known.cookMinutes, 35);
  assert.equal(known.servings, 6);
});

test('preview ingredient parsing retains unsupported or invalid quantities honestly', () => {
  const { parsePreviewIngredient } = require('../src/app/social-preview/recipe-model.ts');
  for (const text of ['Salt to taste', '3-2 tomatoes', '1/0 cup flour']) {
    const parsed = parsePreviewIngredient(text, 0);
    assert.equal(parsed.quantity, null);
    assert.equal(parsed.name, text);
  }
  assert.equal(parsePreviewIngredient('2—3 tomatoes', 0).quantity, '2—3');
  assert.equal(parsePreviewIngredient('200g rice', 0).unit, 'g');
});

test('saved public, family, imported and owned recipes have accurate source labels', () => {
  const { savedRecipeLabel } = require('../src/app/social-preview/recipe-model.ts');
  assert.equal(savedRecipeLabel({...sample, own:false}, ['discover']), 'Saved from Discover');
  assert.equal(savedRecipeLabel({...sample, own:false}, ['The family cookbook']), 'Saved from family');
  assert.equal(savedRecipeLabel({...sample, own:false}, []), 'Saved recipe');
  assert.equal(savedRecipeLabel({...sample, source:'Web import'}, []), 'Web import');
  assert.equal(savedRecipeLabel(sample, ['discover']), 'Your recipe');
});

test('preview detail and cooking use the same quantities as Shopping, including em dashes', () => {
  const { scalePreviewIngredient, previewToMobile } = require('../src/app/social-preview/recipe-model.ts');
  const lines = ['2—3 tomatoes', '1 1/2 cups rice', '½ tsp salt', 'Salt to taste'];
  const rows = buildShoppingList([{id:'meal',servings:4,recipe:mobileToPlannable(previewToMobile(sample,lines,['Mix.']))}]);
  for (let i=0;i<lines.length;i++) {
    const amount=rows[i].amounts[0];
    assert.equal(scalePreviewIngredient(lines[i],2), [amount.quantity,amount.unit,rows[i].name].filter(Boolean).join(' '));
  }
});
