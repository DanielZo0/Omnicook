import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
dotenv.config({path: '.env.local', quiet: true});
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('Configure the intended Neon database first.');
const sql = neon(url);
await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url text`;
console.log('Nullable recipes.image_url column is ready; existing recipes are preserved.');
