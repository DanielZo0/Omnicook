require('./register-ts.cjs');
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns/promises');
const { resolveSource } = require('../src/lib/extraction/fetch-source.ts');
afterEach(() => mock.restoreAll());
function pages(entries) {
  const visited = [];
  mock.method(dns, 'lookup', async () => [{ address: '93.184.215.14', family: 4 }]);
  mock.method(global, 'fetch', async (url) => {
    visited.push(String(url));
    const entry = entries[String(url)];
    assert(entry, `Unexpected fetch ${url}`);
    return new Response(entry.html || '', {status: entry.status || 200, headers: { 'Content-Type': 'text/html', ...(entry.location ? {Location: entry.location} : {}) }});
  });
  return visited;
}
test('Instagram caption survives mixed quotes and reordered metadata attributes', async () => {
  pages({'https://www.instagram.com/p/abc/': {html: `<meta content="Chef's pasta: 200 g pasta. Boil pasta, then toss with tomatoes." property='og:description'><meta content='/dish.jpg' property='og:image'>`}});
  const result = await resolveSource('https://www.instagram.com/p/abc/?igsh=tracking');
  assert(result.text.includes("Chef's pasta"));
  assert.equal(result.imageUrl, 'https://www.instagram.com/dish.jpg');
});
test('Pinterest short link follows pin destination and prefers its structured recipe photo', async () => {
  const visited = pages({
    'https://pin.it/abc': {status: 302, location: 'https://www.pinterest.com/pin/123/'},
    'https://www.pinterest.com/pin/123/': {html: `<meta property='og:image' content='https://i.pinimg.com/pin.jpg'><script type='application/ld+json'>{"@type":"SocialMediaPosting","url":"https://www.pinterest.com/pin/123/","sharedContent":{"@type":"WebPage","url":"https://food.example/pasta"}}</script>`},
    'https://food.example/pasta': {html: `<meta property='og:image' content='/logo.jpg'><script type='application/ld+json'>{"@graph":[{"@type":"Recipe","name":"Tomato pasta","image":{"url":"/pasta.jpg"},"recipeIngredient":["200 g pasta","2 tomatoes"],"recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Boil pasta."},{"@type":"HowToStep","text":"Add tomatoes."}]}]}]}</script>`},
  });
  const result = await resolveSource('https://pin.it/abc');
  assert.equal(result.sourceUrl, 'https://www.pinterest.com/pin/123/');
  assert.equal(result.imageUrl, 'https://food.example/pasta.jpg');
  assert(result.text.includes('200 g pasta')); assert(result.text.includes('Add tomatoes.'));
  assert(visited.includes('https://food.example/pasta'));
});
test('Instagram embedded caption is selected instead of login-shell body', async () => {
  pages({'https://www.instagram.com/reel/abc/': {html: `<script type='application/json'>{"items":[{"code":"abc","caption":{"text":"Pancakes: 80 g oats and 2 eggs. Blend, then fry for two minutes."}}]}</script><div>Log in to Instagram</div>`}});
  const result = await resolveSource('https://www.instagram.com/reel/abc/');
  assert(result.text.includes('80 g oats')); assert(!result.text.includes('Log in'));
});
test('blocked social page asks for caption instead of passing URL to the model', async () => {
  pages({'https://www.instagram.com/p/blocked/': {html: '<title>Instagram</title><p>Log in to see photos and videos</p>'}});
  await assert.rejects(resolveSource('https://www.instagram.com/p/blocked/'), /caption/i);
});
test('title-only Pinterest metadata is not treated as a complete recipe', async () => {
  pages({'https://www.pinterest.com/pin/123/': {html: `<meta property='og:title' content='Amazing pasta'><meta property='og:description' content='Discover this delicious recipe'>`}});
  await assert.rejects(resolveSource('https://www.pinterest.com/pin/123/'), /caption|recipe/i);
});
test('redirects to private networks are rejected before fetching destination', async () => {
  const visited = pages({'https://pin.it/private': {status: 302, location: 'http://127.0.0.1/private'}});
  await assert.rejects(resolveSource('https://pin.it/private'), /public|address/i);
  assert.equal(visited.length, 1);
});
test('oversized response fails with a clear error', async () => {
  pages({'https://food.example/big': {html: 'x'.repeat(2_100_000)}});
  await assert.rejects(resolveSource('https://food.example/big'), /large/i);
});
test('plain pasted caption keeps line breaks', async () => {
  const result = await resolveSource('Ingredients:\n80 g oats\n2 eggs\nBlend and fry.');
  assert(result.text.includes('\n80 g oats\n')); assert.equal(result.imageUrl, null);
});
test('Pinterest og:see_also links to the original recipe even when scripts are not JSON', async () => {
  pages({
    'https://www.pinterest.com/pin/123/': {html: `<meta content='https://food.example/stew' property='og:see_also'><meta property='og:description' content='Great stew'>`},
    'https://food.example/stew': {html: `<script type='application/ld+json'>{"@type":"Recipe","name":"Chickpea stew","image":"/stew.jpg","recipeIngredient":["240 g chickpeas"],"recipeInstructions":"Mix chickpeas and simmer."}</script>`},
  });
  const result = await resolveSource('https://www.pinterest.com/pin/123/');
  assert(result.text.includes('240 g chickpeas')); assert.equal(result.imageUrl, 'https://food.example/stew.jpg');
});
test('angle brackets inside a caption do not truncate its metadata', async () => {
  pages({'https://www.instagram.com/p/abc/': {html: `<meta property='og:description' content="Pasta: 200 g pasta and tomatoes. Boil for > 2 minutes, then add the tomatoes and toss.">`}});
  const result = await resolveSource('https://www.instagram.com/p/abc/');
  assert(result.text.includes('> 2 minutes'));
});
test('a related Instagram caption cannot stand in for a blocked requested post', async () => {
  pages({'https://www.instagram.com/p/blocked/': {html: `<script type='application/json'>{"items":[{"code":"other","caption":{"text":"Pancakes: 80 g oats and 2 eggs. Blend, then fry for two minutes."}}]}</script><div>Log in</div>`}});
  await assert.rejects(resolveSource('https://www.instagram.com/p/blocked/'), /caption/i);
});
test('Pinterest only follows the requested pin link, not related pin links', async () => {
  const visited = pages({
    'https://www.pinterest.com/pin/123/': {html: `<script type='application/json'>{"pins":[{"id":"999","link":"https://food.example/wrong"},{"id":"123","link":"https://food.example/right"}]}</script>`},
    'https://food.example/wrong': {html: `<script type='application/ld+json'>{"@type":"Recipe","name":"Wrong recipe","recipeIngredient":["100 g pasta"],"recipeInstructions":"Boil pasta and toss."}</script>`},
    'https://food.example/right': {html: `<script type='application/ld+json'>{"@type":"Recipe","name":"Correct stew","recipeIngredient":["240 g chickpeas"],"recipeInstructions":"Mix chickpeas and simmer."}</script>`},
  });
  const result = await resolveSource('https://www.pinterest.com/pin/123/');
  assert(result.text.includes('Correct stew')); assert(!visited.includes('https://food.example/wrong'));
});
test('empty structured instructions fall back to the usable visible recipe method', async () => {
  pages({'https://food.example/pasta': {html: `<script type='application/ld+json'>{"@type":"Recipe","name":"Pasta","recipeIngredient":["200 g pasta"],"recipeInstructions":[]}</script><p>Ingredients: 200 g pasta and tomatoes. Boil pasta, then toss with tomatoes for two minutes.</p>`}});
  const result = await resolveSource('https://food.example/pasta');
  assert(result.text.includes('Boil pasta'));
});
test('complete count-based social recipes do not require measurement units', async () => {
  pages({'https://www.instagram.com/p/pancakes/': {html: `<meta property='og:description' content='Banana pancakes: 2 eggs and 1 banana. Mash the banana, mix in the eggs, then fry spoonfuls for two minutes per side.'>`}});
  const result = await resolveSource('https://www.instagram.com/p/pancakes/');
  assert(result.text.includes('2 eggs and 1 banana'));
});
