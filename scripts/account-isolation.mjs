// Integration test: runs the actual HTTP routes against two temporary Neon accounts.
// Requires a local dev server and .env.local pointing at its database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import sharp from 'sharp';

dotenv.config({ path: '.env.local', quiet: true });
const base = process.env.ISOLATION_TEST_BASE_URL || 'http://127.0.0.1:3018';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Run against a local server only.');
assert(process.env.DATABASE_URL, 'DATABASE_URL is required for fixture cleanup.');
const sql = neon(process.env.DATABASE_URL);
const runId = randomUUID();
const password = `Isolation-${randomUUID()}!`;
const accounts = [];
let failures = 0;
let checks = 0;
const draft = {
  title: `Isolation ${runId}`, category: 'Dinner', servings: 2,
  ingredients: [{ position: 0, name: 'Private ingredient', aisle: 'Pantry' }],
  steps: [{ position: 0, instruction: 'Private cooking step.' }],
};

function client() {
  const cookies = new Map();
  return async (path, method = 'GET', body, extraHeaders = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { Origin: process.env.ISOLATION_TEST_AUTH_ORIGIN || base, 'Content-Type': body instanceof Blob ? body.type : 'application/json',
        Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...extraHeaders },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    if (response.headers.get('content-type')?.startsWith('image/')) {
      return {status:response.status,data:{bytes:Buffer.from(await response.arrayBuffer())}};
    }
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: 'Non-JSON response' }; }
    return { status: response.status, data };
  };
}

async function check(name, fn) {
  checks++;
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}

async function createAccount(label) {
  const request = client();
  const email = `omnicook-isolation-${label}-${runId}@example.com`;
  const signup = await request('/api/auth/sign-up/email', 'POST', { email, password, name: `Isolation ${label}` });
  assert.equal(signup.status, 200, `Temporary account creation: ${signup.status} ${signup.data.message || ''}`);
  const id = signup.data.user?.id;
  assert(id, 'Signup must return a user ID');
  accounts.push({ id, email, request });
  const session = await request('/api/auth/get-session');
  assert.equal(session.data?.user?.id, id, 'Session must belong to the new account');
  return { id, request };
}

try {
  const anonymous = client();
  for (const [path, method, body] of [
    ['/api/recipes', 'GET'], ['/api/collections', 'GET'], ['/api/meal-plan', 'GET'],
    ['/api/recipes', 'POST', { draft, sourceUrl: null, collectionId: null }],
    ['/api/collections', 'POST', { name: 'Anonymous' }],
    ['/api/meal-plan', 'POST', { recipeId: randomUUID(), plannedFor: '2026-10-14', mealSlot: 'dinner' }],
    [`/api/recipes/${randomUUID()}`, 'PATCH', { draft }],
    [`/api/recipes/${randomUUID()}`, 'DELETE'],
    [`/api/recipes/${randomUUID()}/photo`, 'GET'],
    [`/api/recipes/${randomUUID()}/photo`, 'POST', new Blob(['photo'],{type:'image/png'})],
  ]) await check(`anonymous ${method} ${path.split('/').slice(0, 4).join('/')} denied`, async () => {
    assert.equal((await anonymous(path, method, body)).status, 401);
  });

  const a = await createAccount('a');
  const b = await createAccount('b');
  const ca = await a.request('/api/collections', 'POST', { name: `A ${runId}` });
  const cb = await b.request('/api/collections', 'POST', { name: `B ${runId}` });
  assert.equal(ca.status, 200); assert.equal(cb.status, 200);
  const collectionA = ca.data.collection.id;
  const collectionB = cb.data.collection.id;
  const ra = await a.request('/api/recipes', 'POST', { draft, sourceUrl: null, collectionId: collectionA });
  const rb = await b.request('/api/recipes', 'POST', { draft: { ...draft, title: `B ${runId}` }, sourceUrl: null, collectionId: collectionB });
  assert.equal(ra.status, 200); assert.equal(rb.status, 200);
  const recipeA = ra.data.id;
  const recipeB = rb.data.id;

  await check('recipe image saves, survives edits, clears, and rejects unsafe URLs', async () => {
    const imageUrl = 'https://food.example/tomato-pasta.jpg';
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'PATCH', {imageUrl})).status, 200);
    let vault = await a.request('/api/recipes');
    assert.equal(vault.data.recipes.find(r => r.id === recipeA).imageUrl, imageUrl);
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'PATCH', {draft})).status, 200);
    vault = await a.request('/api/recipes');
    assert.equal(vault.data.recipes.find(r => r.id === recipeA).imageUrl, imageUrl);
    assert.equal((await b.request(`/api/recipes/${recipeA}`, 'PATCH', {imageUrl: 'https://food.example/other.jpg'})).status, 404);
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'PATCH', {imageUrl: 'javascript:alert(1)'})).status, 400);
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'PATCH', {imageUrl: null})).status, 200);
    vault = await a.request('/api/recipes');
    assert.equal(vault.data.recipes.find(r => r.id === recipeA).imageUrl, null);
    const created = await a.request('/api/recipes', 'POST', {draft, sourceUrl: null, collectionId: null, imageUrl});
    assert.equal(created.status, 200);
    vault = await a.request('/api/recipes');
    assert.equal(vault.data.recipes.find(r => r.id === created.data.id).imageUrl, imageUrl);
  });

  const photoBytes = await sharp({create:{width:30,height:20,channels:3,background:'#dcac45'}}).png().toBuffer();
  const cookingPhoto = new Blob([photoBytes],{type:'image/png'});
  const storedWebp=await sharp(photoBytes).webp().toBuffer();
  await sql`UPDATE recipes SET photo_data=${storedWebp.toString('base64')},photo_metadata=${JSON.stringify({kind:'generated',status:'ready'})}::jsonb WHERE id=${recipeA} AND user_id=${a.id}`;
  await check('unchanged full-draft edits preserve a saved automatic photo',async()=>{
    assert.equal((await a.request(`/api/recipes/${recipeA}`,'PATCH',{draft})).status,200);
    assert.deepEqual((await a.request(`/api/recipes/${recipeA}/photo`)).data.bytes,storedWebp);
    assert.equal((await a.request('/api/recipes')).data.recipes.find(r=>r.id===recipeA).photoMetadata.kind,'generated');
  });
  await check('a changed dish discards its old automatic illustration',async()=>{
    assert.equal((await a.request(`/api/recipes/${recipeA}`,'PATCH',{draft:{...draft,title:'A different dish'}})).status,200);
    assert.equal((await a.request(`/api/recipes/${recipeA}/photo`)).status,404);
  });
  await check('another account cannot upload or read a cooking photo',async()=>{
    assert.equal((await b.request(`/api/recipes/${recipeA}/photo`,'POST',cookingPhoto,{Origin:base})).status,404);
    assert.equal((await b.request(`/api/recipes/${recipeA}/photo`)).status,404);
  });
  await check('owner photo upload persists privately and survives recipe edits',async()=>{
    const uploaded=await a.request(`/api/recipes/${recipeA}/photo`,'POST',cookingPhoto,{Origin:base});
    assert.equal(uploaded.status,200);
    assert(uploaded.data.imageUrl.startsWith(`/api/recipes/${recipeA}/photo`));
    const read=await a.request(`/api/recipes/${recipeA}/photo`);
    assert.equal(read.status,200);
    assert.equal((await sharp(read.data.bytes).metadata()).format,'webp');
    assert.equal((await a.request(`/api/recipes/${recipeA}`,'PATCH',{draft})).status,200);
    const vault=await a.request('/api/recipes');
    const saved=vault.data.recipes.find(r=>r.id===recipeA);
    assert.equal(saved.photoMetadata.kind,'user');
    assert(saved.imageUrl.startsWith(`/api/recipes/${recipeA}/photo`));
    assert.deepEqual((await a.request(`/api/recipes/${recipeA}/photo`)).data.bytes,read.data.bytes);
  });
  await check('disguised and oversized uploads leave the existing cooking photo intact',async()=>{
    const before=(await a.request(`/api/recipes/${recipeA}/photo`)).data.bytes;
    assert.equal((await a.request(`/api/recipes/${recipeA}/photo`,'POST',new Blob(['<svg></svg>'],{type:'image/png'}),{Origin:base})).status,400);
    assert.equal((await a.request(`/api/recipes/${recipeA}/photo`,'POST',new Blob([Buffer.alloc(4_000_001)],{type:'image/png'}),{Origin:base})).status,400);
    assert.deepEqual((await a.request(`/api/recipes/${recipeA}/photo`)).data.bytes,before);
  });
  await check('cross-origin photo upload is rejected',async()=>{
    assert.equal((await a.request(`/api/recipes/${recipeA}/photo`,'POST',cookingPhoto,{Origin:'https://other.example'})).status,403);
  });

  for (const [owner, otherRecipe, otherCollection] of [[a, recipeB, collectionB], [b, recipeA, collectionA]]) {
    await check('vault excludes other account recipes and their children', async () => {
      const result = await owner.request('/api/recipes');
      assert.equal(result.status, 200);
      assert(!result.data.recipes.some(r => r.id === otherRecipe));
      const own = result.data.recipes.find(r => r.id === (owner === a ? recipeA : recipeB));
      assert(own); assert.equal(own.ingredients[0].name, 'Private ingredient');
      assert.equal(own.steps[0].instruction, 'Private cooking step.');
    });
    await check('collections exclude other account collections', async () => {
      const result = await owner.request('/api/collections');
      assert.equal(result.status, 200);
      assert(!result.data.collections.some(c => c.id === otherCollection));
    });
    await check('editing another account recipe denied', async () => {
      assert.equal((await owner.request(`/api/recipes/${otherRecipe}`, 'PATCH', { draft: { ...draft, title: 'Intrusion' } })).status, 404);
    });
    await check('deleting another account recipe denied', async () => {
      assert.equal((await owner.request(`/api/recipes/${otherRecipe}`, 'DELETE')).status, 404);
    });
    await check('creating recipe in another account collection denied', async () => {
      assert.equal((await owner.request('/api/recipes', 'POST', { draft, sourceUrl: null, collectionId: otherCollection })).status, 404);
    });
    await check('assigning own recipe to another account collection denied', async () => {
      const ownId = owner === a ? recipeA : recipeB;
      assert.equal((await owner.request(`/api/recipes/${ownId}`, 'PATCH', { collectionId: otherCollection })).status, 404);
    });
    await check('planning another account recipe denied', async () => {
      assert.equal((await owner.request('/api/meal-plan', 'POST', { recipeId: otherRecipe, plannedFor: '2026-10-14', mealSlot: 'dinner' })).status, 404);
    });
  }

  await check('meal plan hides legacy cross-account recipe references', async () => {
    await sql`INSERT INTO meal_plan_items (user_id, recipe_id, planned_for, meal_slot)
      VALUES (${b.id}, ${recipeA}, '2026-10-15', 'lunch')`;
    const result = await b.request('/api/meal-plan');
    assert.equal(result.status, 200);
    assert(!result.data.items.some(item => item.recipeId === recipeA));
  });
  await check('missing recipe and collection references denied', async () => {
    assert.equal((await a.request('/api/meal-plan', 'POST', { recipeId: randomUUID(), plannedFor: '2026-10-14', mealSlot: 'snack' })).status, 404);
    assert.equal((await a.request('/api/recipes', 'POST', { draft, sourceUrl: null, collectionId: randomUUID() })).status, 404);
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'PATCH', { collectionId: randomUUID() })).status, 404);
  });
  await check('rejected collection assignments leave no cross-account links', async () => {
    const rows = await sql`SELECT r.id FROM recipes r JOIN collections c ON c.id = r.collection_id
      WHERE r.user_id IN (${a.id}, ${b.id}) AND r.user_id <> c.user_id`;
    assert.equal(rows.length, 0);
  });
  await check('owners can create recipes without a collection', async () => {
    assert.equal((await a.request('/api/recipes', 'POST', { draft, sourceUrl: null, collectionId: null })).status, 200);
  });
  await check('owners can edit, clear collection, plan and delete their recipes', async () => {
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'PATCH', { collectionId: collectionA, draft: { ...draft, title: 'Owner edit' } })).status, 200);
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'PATCH', { collectionId: null })).status, 200);
    assert.equal((await a.request('/api/meal-plan', 'POST', { recipeId: recipeA, plannedFor: '2026-10-14', mealSlot: 'dinner' })).status, 200);
    assert.equal((await b.request('/api/meal-plan', 'POST', { recipeId: recipeB, plannedFor: '2026-10-14', mealSlot: 'dinner' })).status, 200);
    assert.equal((await b.request('/api/meal-plan', 'POST', { recipeId: recipeA, plannedFor: '2026-10-14', mealSlot: 'dinner' })).status, 404);
    const planA = await a.request('/api/meal-plan');
    const planB = await b.request('/api/meal-plan');
    assert.equal(planA.status, 200); assert.equal(planB.status, 200);
    assert(planA.data.items.some(i => i.recipeId === recipeA && i.recipeTitle === 'Owner edit'));
    assert(!planA.data.items.some(i => i.recipeId === recipeB));
    assert(planB.data.items.some(i => i.recipeId === recipeB));
    assert(!planB.data.items.some(i => i.recipeId === recipeA));
    assert.equal((await a.request(`/api/recipes/${recipeA}`, 'DELETE')).status, 200);
    assert.equal((await b.request(`/api/recipes/${recipeB}`, 'DELETE')).status, 200);
  });
} catch (error) {
  failures++; console.error(`SETUP/EXECUTION FAILED: ${error.message}`);
} finally {
  for (const account of accounts) {
    try {
      // Delete only IDs returned by this run's signup, never existing users' data.
      await sql`DELETE FROM meal_plan_items WHERE user_id = ${account.id}`;
      await sql`DELETE FROM recipes WHERE user_id = ${account.id}`;
      await sql`DELETE FROM collections WHERE user_id = ${account.id}`;
      await sql`DELETE FROM seeded_users WHERE user_id = ${account.id}`;
      const deleted = await account.request('/api/auth/delete-user', 'POST', { password });
      if (deleted.status !== 200) {
        // Managed Neon Auth may not expose delete-user. The database owner can
        // remove this run's exact ID/email; auth account/session FKs cascade.
        await sql`DELETE FROM neon_auth."user" WHERE id = ${account.id} AND email = ${account.email}`;
        const remaining = await sql`SELECT id FROM neon_auth."user" WHERE id = ${account.id}`;
        assert.equal(remaining.length, 0, 'Temporary auth account must be removed');
        console.log('Temporary account and fixtures removed via database cleanup.');
      } else console.log('Temporary account and fixtures removed.');
    } catch (error) { failures++; console.error(`CLEANUP FAILED for ${account.id}: ${error.message}`); }
  }
}
console.log(`${checks} checks; ${failures} failures.`);
process.exitCode = failures ? 1 : 0;
