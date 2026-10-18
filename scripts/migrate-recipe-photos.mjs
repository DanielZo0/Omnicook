import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
dotenv.config({path:'.env.local',quiet:true});
const url=process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if(!url) throw new Error('Configure the intended Neon database first.');
const sql=neon(url);
await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS photo_data text, ADD COLUMN IF NOT EXISTS photo_metadata jsonb`;
console.log('Recipe photo storage and metadata are ready; existing recipes preserved.');
