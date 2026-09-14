import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

config({ path: '.env.local' });

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Schema migrations need the direct/unpooled connection — PgBouncer's
    // transaction-mode pooling doesn't support the session-level operations
    // drizzle-kit push relies on.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
