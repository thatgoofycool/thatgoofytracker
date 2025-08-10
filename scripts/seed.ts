import { config as loadEnv } from 'dotenv';
// Load local env for CLI execution
loadEnv({ path: '.env.local' });
loadEnv();
import { db, tags } from '@/lib/db';

async function main() {
  await db.insert(tags).values([
    { name: 'reference_needed', slug: 'reference-needed', color: 'amber' },
    { name: 'melodic_update', slug: 'melodic-update', color: 'violet' },
    { name: 'bass_update', slug: 'bass-update', color: 'cyan' },
    { name: 'misc_changes', slug: 'misc-changes', color: 'slate' },
    { name: 'mixing', slug: 'mixing', color: 'sky' },
    { name: 'mastering', slug: 'mastering', color: 'emerald' },
  ]).onConflictDoNothing();
  console.log('Seeded default tags');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });


