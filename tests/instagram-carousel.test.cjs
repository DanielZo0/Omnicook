require('./register-ts.cjs');
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns/promises');
const { parseSourcePage } = require('../src/lib/extraction/source-page.ts');

const post = 'https://www.instagram.com/p/DfGpRKSCCKR/';
const tracked = post + '?img_index=5&psln=tracking';
const cdn = 'https://instagram.fixture.fbcdn.net';
const targetImage = cdn + '/slide-5.jpg';
const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
const image = url => ({ media_type: 1, image_versions2: { candidates: [{ url }] } });
const slides = Array.from({ length: 7 }, (_, i) => image(cdn + '/slide-' + (i + 1) + '.jpg'));
slides[3] = { ...slides[3], media_type: 2 };
const transcript = {
  text: 'Torta Margherita\n150 g farina\n150 g fecola di patate\n200 g zucchero\n150 g burro fuso\n4 uova grandi\n8 g lievito chimico\nCottura a 180 gradi per 35 o 40 minuti',
  preparationLines: [],
  bakeLine: 'Cottura a 180 gradi per 35 o 40 minuti',
};
function page(caption = 'Segui il profilo per altri dolci.') {
  return '<meta property="og:description" content="Follow this account for more cake ideas and baking inspiration throughout the week.">' +
    '<script type="application/json">' + JSON.stringify({ items: [
      { code: 'other', carousel_media: [image(cdn + '/unrelated.jpg')] },
      { code: 'DfGpRKSCCKR', caption: { text: caption }, carousel_media: slides },
    ] }) + '</script>';
}
function publicDns() {
  mock.method(dns, 'lookup', async () => [{ address: '93.184.215.14', family: 4 }]);
}
afterEach(() => mock.restoreAll());

test('selects only the requested one-based image while keeping non-image slots', () => {
  const carousel = parseSourcePage(page(), tracked).instagramCarousel;
  assert.equal(carousel?.shortcode, 'DfGpRKSCCKR');
  assert.equal(carousel.slides.length, 7);
  assert.equal(carousel.slides[3], null);
  const { selectCarouselSlide } = require('../src/lib/extraction/instagram-carousel.ts');
  assert.deepEqual(selectCarouselSlide(new URL(tracked), carousel), {
    index: 5, url: targetImage, sourceUrl: post + '?img_index=5',
  });
  for (const query of ['', '?img_index=4', '?img_index=5&img_index=5', '?img_index=5.0', '?img_index=0', '?img_index=-5', '?img_index=bad', '?img_index=8']) {
    assert.equal(selectCarouselSlide(new URL(post + query), carousel), null, query);
  }
  assert.equal(selectCarouselSlide(new URL('https://www.instagram.com/p/unrelated/?img_index=5'), carousel), null);
  assert.equal(parseSourcePage(page(), 'https://www.instagram.com/accounts/login/').instagramCarousel, null);
});

test('fetches a bounded public Instagram image without following redirects', async () => {
  const { fetchCarouselImage } = require('../src/lib/extraction/fetch-source.ts');
  publicDns();
  const fetch = mock.method(global, 'fetch', async (_url, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  });
  const signal = AbortSignal.timeout(500);
  assert.deepEqual(await fetchCarouselImage(targetImage, signal), { bytes: jpeg, mimeType: 'image/jpeg' });
  for (const url of ['http://instagram.fixture.fbcdn.net/x', 'https://user@instagram.fixture.fbcdn.net/x', 'https://fbcdn.net.evil.example/x', 'https://instagram.fixture.fbcdn.net:8443/x']) {
    await assert.rejects(() => fetchCarouselImage(url, signal));
  }
  assert.equal(fetch.mock.callCount(), 1);
});

test('rejects private DNS, redirects, wrong MIME, and oversized streamed bodies', async () => {
  const { fetchCarouselImage } = require('../src/lib/extraction/fetch-source.ts');
  const lookup = mock.method(dns, 'lookup', async () => [{ address: '127.0.0.1', family: 4 }]);
  const fetch = mock.method(global, 'fetch', async () => new Response(jpeg));
  const signal = AbortSignal.timeout(1000);
  await assert.rejects(() => fetchCarouselImage(targetImage, signal));
  assert.equal(fetch.mock.callCount(), 0);
  lookup.mock.mockImplementation(async () => [{ address: '93.184.215.14', family: 4 }]);
  for (const response of [
    new Response(null, { status: 302, headers: { Location: targetImage } }),
    new Response('not an image', { headers: { 'Content-Type': 'text/html' } }),
    new Response(new Uint8Array(2_000_001), { headers: { 'Content-Type': 'image/jpeg' } }),
  ]) {
    fetch.mock.mockImplementation(async () => response);
    await assert.rejects(() => fetchCarouselImage(targetImage, signal));
  }
});

test('cancels a pending image stream when its source signal aborts', async () => {
  const { fetchCarouselImage } = require('../src/lib/extraction/fetch-source.ts');
  publicDns();
  const controller = new AbortController();
  const cancel = mock.fn();
  mock.method(global, 'fetch', async () => {
    setImmediate(() => controller.abort());
    return new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'image/jpeg' } });
  });
  await assert.rejects(() => fetchCarouselImage(targetImage, controller.signal), { name: 'AbortError' });
  assert.equal(cancel.mock.callCount(), 1);
});

test('uses opt-in Groq vision with inline bytes and validates quoted evidence', async () => {
  const { selectCarouselTranscriber } = require('../src/lib/extraction/groq.ts');
  const original = { key: process.env.GROQ_API_KEY, model: process.env.GROQ_CAROUSEL_OCR_MODEL };
  try {
    delete process.env.GROQ_CAROUSEL_OCR_MODEL;
    assert.equal(selectCarouselTranscriber(), null);
    process.env.GROQ_API_KEY = 'fixture-key';
    process.env.GROQ_CAROUSEL_OCR_MODEL = 'fixture-vision-model';
    let result = transcript;
    mock.method(global, 'fetch', async (url, init) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'fixture-vision-model');
      assert.equal(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,/9j/2Q==');
      return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
    });
    const read = selectCarouselTranscriber();
    const input = { bytes: jpeg, mimeType: 'image/jpeg' };
    assert.deepEqual(await read(input, 1000), transcript);
    for (const invalid of [{ ...transcript, text: '' }, { ...transcript, bakeLine: 'invented' }, { ...transcript, preparationLines: [1] }]) {
      result = invalid;
      await assert.rejects(() => read(input, 1000));
    }
  } finally {
    for (const [name, value] of [['GROQ_API_KEY', original.key], ['GROQ_CAROUSEL_OCR_MODEL', original.model]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('imports a selected image as an incomplete recipe and drops invented preparation', async () => {
  const { importRecipe } = require('../src/lib/extraction/import-recipe.ts');
  publicDns();
  const requests = [];
  mock.method(global, 'fetch', async url => {
    requests.push(String(url));
    if (String(url) === tracked) return new Response(page(), { headers: { 'Content-Type': 'text/html' } });
    assert.equal(String(url), targetImage);
    return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  });
  const transcribe = mock.fn(async () => transcript);
  const ingredients = [
    ['150', 'g', 'farina'], ['150', 'g', 'fecola di patate'], ['200', 'g', 'zucchero'],
    ['150', 'g', 'burro fuso'], ['4', null, 'uova grandi'], ['8', 'g', 'lievito chimico'],
  ].map(([quantity, unit, name], position) => ({ position, quantity, unit, name }));
  const extract = mock.fn(async (source, text) => {
    assert.equal(source, post + '?img_index=5');
    assert.equal(text, transcript.text);
    return {
      title: 'Torta Margherita', ingredients,
      steps: [{ position: 0, instruction: 'Mix the ingredients.' }],
      prepMinutes: 5, cookMinutes: 40, servings: 8, completeness: 'complete', missingFields: [],
    };
  });
  const result = await importRecipe({ source: tracked }, { name: 'groq', extract }, undefined, transcribe);
  assert.deepEqual(requests, [tracked, targetImage]);
  assert.equal(transcribe.mock.callCount(), 1);
  assert.equal(extract.mock.callCount(), 1);
  assert.equal(result.sourceUrl, post + '?img_index=5');
  assert.equal(result.imageUrl, null);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.missingFields, ['instructions']);
  assert.equal(result.draft.title, 'Torta Margherita');
  assert.deepEqual(result.draft.ingredients.map(({ quantity, unit, name }) => [quantity, unit, name]), ingredients.map(({ quantity, unit, name }) => [quantity, unit, name]));
  assert.deepEqual(result.draft.steps, [{ position: 0, instruction: transcript.bakeLine }]);
  assert.deepEqual([result.draft.servings, result.draft.prepMinutes, result.draft.cookMinutes], [null, null, null]);
});

test('offers slide-specific recovery and never fetches a neighboring slide', async () => {
  const { importRecipe } = require('../src/lib/extraction/import-recipe.ts');
  const { SourceReadError } = require('../src/lib/extraction/fetch-source.ts');
  publicDns();
  let imageStatus = 403;
  const requests = [];
  mock.method(global, 'fetch', async url => {
    requests.push(String(url));
    if (String(url).startsWith(post)) return new Response(page(), { headers: { 'Content-Type': 'text/html' } });
    return new Response(jpeg, { status: imageStatus, headers: { 'Content-Type': 'image/jpeg' } });
  });
  const extract = mock.fn(async () => ({ error: 'insufficient_recipe_content' }));
  const provider = { name: 'groq', extract };
  const transcribe = mock.fn(async () => transcript);
  for (const url of [post, post + '?img_index=8']) {
    await assert.rejects(importRecipe({ source: url }, provider, undefined, transcribe), error => error instanceof SourceReadError && /multiple slides/.test(error.message));
  }
  await assert.rejects(importRecipe({ source: tracked }, provider), error => error instanceof SourceReadError && /selected Instagram slide/.test(error.message));
  await assert.rejects(importRecipe({ source: tracked }, provider, undefined, transcribe), /selected Instagram slide/);
  imageStatus = 200;
  await assert.rejects(importRecipe({ source: tracked }, provider, undefined, async () => { throw new Error('timeout'); }), /selected Instagram slide/);
  assert.equal(extract.mock.callCount(), 0);
  assert.equal(transcribe.mock.callCount(), 0);
  await assert.rejects(importRecipe({ source: tracked }, provider, undefined, async () => ({ text: 'Cake carousel cover', preparationLines: [], bakeLine: null })), /selected Instagram slide/);
  assert.equal(extract.mock.callCount(), 1);
  assert.deepEqual(requests.filter(url => !url.startsWith(post)), [targetImage, targetImage, targetImage]);
});

test('normal API route returns selected-slide review and canonical recovery', async () => {
  const path = require('node:path');
  const Module = require('node:module');
  const resolve = Module._resolveFilename;
  mock.method(Module, '_resolveFilename', function (request, ...args) {
    return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
  });
  const providerModule = require('../src/lib/extraction/provider.ts');
  const groq = require('../src/lib/extraction/groq.ts');
  mock.method(providerModule, 'selectExtractionProvider', () => ({
    name: 'groq',
    extract: async () => ({
      title: 'Torta Margherita', ingredients: [{ position: 0, name: 'farina', quantity: '150', unit: 'g' }],
      steps: [], completeness: 'incomplete', missingFields: ['instructions'],
    }),
  }));
  mock.method(groq, 'selectCarouselTranscriber', () => async () => transcript);
  publicDns();
  mock.method(global, 'fetch', async url => String(url).startsWith(post)
    ? new Response(page(), { headers: { 'Content-Type': 'text/html' } })
    : new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } }));
  const { POST } = require('../src/app/api/import/route.ts');
  const request = source => new Request('http://localhost/api/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }),
  });
  const selected = await POST(request(tracked));
  const result = await selected.json();
  assert.equal(selected.status, 200);
  assert.equal(result.status, 'incomplete');
  assert.equal(result.sourceUrl, post + '?img_index=5');
  const canonical = await POST(request(post));
  assert.equal(canonical.status, 422);
  assert.match((await canonical.json()).message, /multiple slides/);
});

test('image recovery shares the cumulative AI budget with text extraction', async () => {
  const { importRecipe } = require('../src/lib/extraction/import-recipe.ts');
  const { createImportBudget } = require('../src/lib/extraction/import-budget.ts');
  publicDns();
  mock.method(global, 'fetch', async url => String(url).startsWith(post)
    ? new Response(page(), { headers: { 'Content-Type': 'text/html' } })
    : new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } }));
  let now = 0;
  const budget = createImportBudget(() => now);
  const transcribe = async (_image, timeoutMs) => {
    assert.equal(timeoutMs, 10_000);
    now += 3000;
    return transcript;
  };
  const extract = async (_url, _text, options) => {
    assert.equal(options.timeoutMs, 33_000);
    return { title: 'Torta Margherita', ingredients: [{ position: 0, name: 'farina' }], steps: [], completeness: 'incomplete', missingFields: ['instructions'] };
  };
  const result = await importRecipe({ source: tracked }, { name: 'groq', extract }, budget, transcribe);
  assert.equal(result.status, 'incomplete');
  for (let i = 0; i < 4; i++) budget.takeAdditionalRequest();
  assert.throws(() => budget.takeAdditionalRequest(), /request limit/);
});

test('caption-backed carousel keeps the caption path and skips OCR', async () => {
  const { importRecipe } = require('../src/lib/extraction/import-recipe.ts');
  publicDns();
  const caption = 'Pancakes with 80 g flour and 2 eggs. Whisk the flour and eggs, then fry the batter.';
  const fetch = mock.method(global, 'fetch', async () => new Response(page(caption), { headers: { 'Content-Type': 'text/html' } }));
  const transcribe = mock.fn(async () => transcript);
  const result = await importRecipe({ source: tracked }, { name: 'groq', extract: async (_, text) => {
    assert.equal(text, caption);
    return { title: 'Pancakes', ingredients: [{ position: 0, name: 'flour' }], steps: [{ position: 0, instruction: 'Whisk and fry.' }], completeness: 'complete', missingFields: [] };
  } }, undefined, transcribe);
  assert.equal(result.status, 'complete');
  assert.equal(result.sourceUrl, tracked);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(transcribe.mock.callCount(), 0);
});
