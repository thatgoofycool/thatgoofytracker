import { defineConfig } from 'drizzle-kit';
import { config as loadEnv } from 'dotenv';

// Load env for CLI usage; prefer .env.local if present
loadEnv({ path: '.env.local' });
loadEnv();

export default defineConfig({
  schema: './lib/db.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL || '',
  },
});


