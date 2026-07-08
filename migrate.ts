import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Carrega .env sempre. Se NODE_ENV !== 'production' e houver .env.development,
// carrega por cima (mesmo comportamento do Next.js: dev sobrescreve o padrão).
loadEnv({ path: '.env' });
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'production' && existsSync('.env.development')) {
    loadEnv({ path: '.env.development', override: true });
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) throw new Error('TURSO_DATABASE_URL missing');

console.log(`→ migrating against ${url} (NODE_ENV=${nodeEnv})`);

const client = createClient({ url, authToken });
const MIGRATIONS_DIR = join(process.cwd(), 'src/db/migrations');

async function main() {
    await client.execute(
        `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`
    );
    const appliedRes = await client.execute(`SELECT name FROM _migrations`);
    const applied = new Set(appliedRes.rows.map((r: any) => r.name as string));

    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
        if (applied.has(file)) {
            console.log(`✓ skip ${file}`);
            continue;
        }
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
        console.log(`→ applying ${file} (${statements.length} statement(s))`);
        for (const stmt of statements) {
            try {
                await client.execute(stmt);
            } catch (err: any) {
                const msg = String(err?.message ?? err);
                if (/duplicate column|already exists/i.test(msg)) {
                    console.log(`  ⚠ ignored: ${msg}`);
                    continue;
                }
                throw err;
            }
        }
        await client.execute({
            sql: `INSERT INTO _migrations (name, applied_at) VALUES (?, ?)`,
            args: [file, new Date().toISOString()],
        });
        console.log(`✓ applied ${file}`);
    }
    console.log('done.');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
