import fs from 'node:fs';
import dotenv from 'dotenv';
import {neon} from '@neondatabase/serverless';
const [envFile,expectedHost]=process.argv.slice(2);
if(!envFile?.includes('integration')||!expectedHost)throw Error('Pass explicit integration environment and independently verified direct endpoint.');
const env=dotenv.parse(fs.readFileSync(envFile));const url=env.DATABASE_URL_UNPOOLED;
if(env.NEON_BRANCH_KIND!=='integration'||!url||new URL(url).hostname!==expectedHost||expectedHost.includes('-pooler'))throw Error('Verified direct integration endpoint required.');
const sql=neon(url);
await sql.transaction([
 sql`CREATE TABLE IF NOT EXISTS planner_state(user_id text PRIMARY KEY,revision integer NOT NULL DEFAULT 0,preferences jsonb NOT NULL DEFAULT '{}'::jsonb)`,
 sql`INSERT INTO planner_state(user_id) SELECT DISTINCT user_id FROM meal_plan_items ON CONFLICT DO NOTHING`,
 sql`CREATE TABLE IF NOT EXISTS planner_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,recipe jsonb NOT NULL,saved_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now())`,
 sql`ALTER TABLE meal_plan_items ALTER COLUMN recipe_id DROP NOT NULL`,
 sql`ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES planner_snapshots(id),ADD COLUMN IF NOT EXISTS servings numeric NOT NULL DEFAULT 1,ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT true,ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1`,
 sql`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='meal_plan_source_one') THEN ALTER TABLE meal_plan_items ADD CONSTRAINT meal_plan_source_one CHECK((recipe_id IS NOT NULL)::int+(snapshot_id IS NOT NULL)::int=1);END IF;END $$`,
 sql`CREATE TABLE IF NOT EXISTS nutrition_analyses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,fingerprint text NOT NULL,provider_key text NOT NULL,analysis jsonb NOT NULL,matches jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,recipe_id,fingerprint,provider_key))`,
 sql`CREATE TABLE IF NOT EXISTS nutrient_food_cache(provider_id text NOT NULL,external_id text NOT NULL,normalization_version text NOT NULL,record jsonb NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(provider_id,external_id,normalization_version))`,
 sql`CREATE TABLE IF NOT EXISTS planner_generations(id uuid PRIMARY KEY,user_id text NOT NULL,draft jsonb NOT NULL,expires_at timestamptz NOT NULL)`,
 sql`CREATE TABLE IF NOT EXISTS planner_applications(user_id text NOT NULL,idempotency_key uuid NOT NULL,generation_id uuid NOT NULL,result jsonb NOT NULL,PRIMARY KEY(user_id,idempotency_key))`,
 sql`CREATE TABLE IF NOT EXISTS planner_provider_budgets(budget_key text PRIMARY KEY,used integer NOT NULL,expires_at timestamptz NOT NULL)`,
]);
console.log('Additive planner schema installed on verified integration branch; original business rows retained.');
