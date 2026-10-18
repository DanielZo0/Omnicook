import assert from 'node:assert/strict';
const r=await fetch('http://127.0.0.1:3018/api/recipes/00000000-0000-4000-8000-000000000001/photo');
assert.equal(r.status,401,'Recipe photos must deny anonymous access');
