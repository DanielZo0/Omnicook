import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import dotenv from 'dotenv';
import {neon} from '@neondatabase/serverless';
const env=dotenv.parse(fs.readFileSync(process.argv[2]||'.env.integration.local'));
if(env.NEON_BRANCH_KIND!=='integration'||!env.DATABASE_URL||new URL(env.DATABASE_URL).hostname!==process.argv[3])throw Error('Pass an independently verified integration env file and endpoint host.');
process.env.DATABASE_URL=env.DATABASE_URL;process.env.RECIPE_PHOTOS_ENABLED='false';
const require=createRequire(import.meta.url);require('../tests/register-ts.cjs');
const Module=require('node:module'),load=Module._load,resolve=Module._resolveFilename;
const users=['integration-a-'+randomUUID(),'integration-b-'+randomUUID()];let actor=users[0];let checks=0;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.resolve('src',name.slice(2)):name,...args)};
Module._load=function(name,...args){if(name==='server-only')return {};if(name==='@/lib/auth/require-user')return {requireUserId:async()=>actor};return load.call(this,name,...args)};
const collectionRoute=require('../src/app/api/recipes/route.ts'),itemRoute=require('../src/app/api/recipes/[id]/route.ts');
const sql=neon(env.DATABASE_URL);const ok=(condition)=>{assert.ok(condition);checks++};
const draft={title:'Integration nascondini',ingredients:[{position:0,name:'farina',quantity:'350',unit:'g'}],steps:[{position:0,instruction:'Impastate e infornate.'}]};
const sourceUrl='https://www.instagram.com/reel/DepF_tWsXH7/',originalRecipeUrl='https://www.tuorlorosso.it/nascondini-fatti-in-casa/';
const request=(method,body)=>new Request('http://integration.local/api/recipes',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
try{
 const created=await collectionRoute.POST(request('POST',{draft,sourceUrl,originalRecipeUrl,collectionId:null}));ok(created.status===200);const {id}=await created.json();
 const list=await (await collectionRoute.GET()).json();const saved=list.recipes.find(r=>r.id===id);ok(saved.sourceUrl===sourceUrl);ok(saved.originalRecipeUrl===originalRecipeUrl);
 const params={params:Promise.resolve({id})};
 await sql`UPDATE recipes SET photo_data='integration-photo',photo_metadata='{"kind":"user","status":"ready"}'::jsonb WHERE id=${id}`;
 ok((await itemRoute.PATCH(request('PATCH',{collectionId:null}),params)).status===200);
 let [row]=await sql`SELECT original_recipe_url,photo_data FROM recipes WHERE id=${id}`;ok(row.original_recipe_url===originalRecipeUrl);ok(row.photo_data==='integration-photo');
 actor=users[1];ok((await itemRoute.PATCH(request('PATCH',{originalRecipeUrl:null}),params)).status===404);
 actor=users[0];ok((await itemRoute.PATCH(request('PATCH',{originalRecipeUrl:null}),params)).status===200);
 [row]=await sql`SELECT original_recipe_url,photo_data FROM recipes WHERE id=${id}`;ok(row.original_recipe_url===null);ok(row.photo_data==='integration-photo');
 ok((await collectionRoute.POST(request('POST',{draft:{...draft,steps:[]},sourceUrl,collectionId:null}))).status===400);
 ok((await collectionRoute.POST(request('POST',{draft:{...draft,steps:[{position:0,instruction:' '}]},sourceUrl,collectionId:null}))).status===400);
 const legacy=await collectionRoute.POST(request('POST',{draft,sourceUrl,collectionId:null}));ok(legacy.status===200);const legacyId=(await legacy.json()).id;
 const [old]=await sql`SELECT original_recipe_url FROM recipes WHERE id=${legacyId}`;ok(old.original_recipe_url===null);
 console.log(JSON.stringify({checks,scope:'actual API handlers and isolated SQL; authentication identity stubbed, no production auth writes'}));
}finally{
 for(const user of users){await sql`DELETE FROM recipes WHERE user_id=${user}`;await sql`DELETE FROM seeded_users WHERE user_id=${user}`;}
 Module._load=load;Module._resolveFilename=resolve;
 console.log('Temporary integration recipes/seed markers removed.');
}
