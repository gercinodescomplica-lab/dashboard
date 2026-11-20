/**
 * Cópia completa (schema + dados, incluindo _migrations) do banco de prod para um arquivo SQLite novo.
 * Só faz SELECT em prod. Não toca no temp/database.db do dev.
 *
 * Uso:
 *   set -a && . /caminho/fora/do/repo/envs/.env && set +a && npx tsx scripts/backup-prod.ts
 *   → temp/backups/prod-<data-hora>.db
 */
import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || url.startsWith('file:')) throw new Error('TURSO_DATABASE_URL precisa apontar para o Turso de prod.');

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = `temp/backups/prod-${stamp}.db`;
mkdirSync('temp/backups', { recursive: true });
if (existsSync(outPath)) throw new Error(`${outPath} já existe`);

const prod = createClient({ url, authToken });
const out = createClient({ url: `file:./${outPath}` });

async function main() {
    console.log(`→ ${url}  →  ${outPath}`);
    const objs = (await prod.execute(
        `SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
         ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END`,
    )).rows as unknown as { type: string; name: string; sql: string }[];

    await out.execute('PRAGMA foreign_keys = OFF'); // cópia fiel: ordem das tabelas não importa
    const tables = objs.filter(o => o.type === 'table');
    for (const t of tables) await out.execute(t.sql);

    let totalProd = 0, totalOut = 0;
    for (const { name } of tables) {
        const rows = (await prod.execute(`SELECT * FROM "${name}"`));
        const cols = rows.columns.map(c => `"${c}"`).join(', ');
        const ph = rows.columns.map(() => '?').join(', ');
        for (let i = 0; i < rows.rows.length; i += 200) {
            await out.batch(rows.rows.slice(i, i + 200).map(r => ({
                sql: `INSERT INTO "${name}" (${cols}) VALUES (${ph})`,
                args: rows.columns.map(c => r[c] as never),
            })), 'write');
        }
        const n = Number((await out.execute(`SELECT COUNT(*) n FROM "${name}"`)).rows[0].n);
        if (n !== rows.rows.length) throw new Error(`${name}: prod ${rows.rows.length} ≠ cópia ${n}`);
        totalProd += rows.rows.length; totalOut += n;
        console.log(`  ${name.padEnd(28)} ${n}`);
    }
    // Índices/triggers/views depois dos dados.
    for (const o of objs.filter(o => o.type !== 'table')) await out.execute(o.sql);

    console.log(`\n✓ ${tables.length} tabelas, ${totalOut}/${totalProd} linhas copiadas → ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
