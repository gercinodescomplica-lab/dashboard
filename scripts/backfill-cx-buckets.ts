// Distribui os itens de CX que estão sem bucket (bucket_id IS NULL) nas
// colunas certas do board /settings/cx-planner, pelo status:
//   resolvido            -> "Concluído"
//   pendente / analise   -> "CX - Em Análise"
// Fallback: primeiro bucket por posição. Não mexe em quem já tem bucket.
//
// Uso:  npx tsx scripts/backfill-cx-buckets.ts            (dry-run)
//       npx tsx scripts/backfill-cx-buckets.ts --apply
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { createClient } from '@libsql/client';

loadEnv({ path: '.env' });
if (process.env.NODE_ENV !== 'production' && existsSync('.env.development')) {
    loadEnv({ path: '.env.development', override: true });
}

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('TURSO_DATABASE_URL missing');
const apply = process.argv.includes('--apply');
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const NAME_FOR_STATUS: Record<string, string> = {
    pendente: 'CX - Em Análise',
    analise: 'CX - Em Análise',
    resolvido: 'Concluído',
};

async function main() {
    console.log(`→ ${apply ? 'APPLY' : 'DRY-RUN'} contra ${url}`);
    const bucketsRes = await client.execute('SELECT id, name, position FROM cx_buckets ORDER BY position');
    const buckets = bucketsRes.rows as unknown as { id: number; name: string; position: number }[];
    if (buckets.length === 0) {
        console.log('Nenhum bucket cadastrado — rode `npm run db:migrate` primeiro (0014).');
        process.exit(1);
    }
    const byName = new Map(buckets.map((b) => [b.name.trim().toLowerCase(), b.id]));
    const firstId = buckets[0].id;
    const bucketFor = (status: string) => byName.get((NAME_FOR_STATUS[status] ?? '').toLowerCase()) ?? firstId;

    const rowsRes = await client.execute("SELECT id, status FROM cx WHERE bucket_id IS NULL");
    const rows = rowsRes.rows as unknown as { id: number; status: string }[];
    console.log(`→ ${rows.length} item(ns) sem bucket`);

    const plan = new Map<number, number>();
    for (const r of rows) plan.set(r.id, bucketFor(r.status));

    const counts: Record<number, number> = {};
    for (const bid of plan.values()) counts[bid] = (counts[bid] ?? 0) + 1;
    for (const b of buckets) console.log(`   ${String(counts[b.id] ?? 0).padStart(4)}  → ${b.name}`);

    if (!apply) {
        console.log('\n(dry-run — nada gravado. Rode de novo com --apply.)');
        process.exit(0);
    }
    for (const [cxId, bucketId] of plan) {
        await client.execute({ sql: 'UPDATE cx SET bucket_id = ? WHERE id = ?', args: [bucketId, cxId] });
    }
    console.log(`✓ ${plan.size} item(ns) atualizados.`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
