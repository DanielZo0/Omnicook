import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured.');
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof getDb> | undefined;

export function db() {
  cached ??= getDb();
  return cached;
}

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
