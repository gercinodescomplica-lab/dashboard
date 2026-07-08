/**
 * Sincroniza o snapshot atual de prod para o SQLite local (temp/database.db).
 *
 * - Prod: lido do .env (TURSO_DATABASE_URL apontando para o Turso online).
 * - Local: file:./temp/database.db.
 *
 * Estratégia: para cada tabela de usuário existente em prod, apaga o conteúdo
 * local e reinsere linha por linha (em batches). Não altera o schema local —
 * ele deve estar atualizado via `npm run db:migrate` (rodado com este mesmo
 * .env.development apontando pro file local).
 *
 * Uso:
 *   npm run db:sync-prod
 *
 * Segurança: só ESCREVE no local. Nunca escreve no prod (só SELECT).
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type Client } from '@libsql/client';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Carrega .env (prod). Ignora .env.development de propósito — este script
// SEMPRE lê de prod (source of truth) para escrever no local.
loadEnv({ path: '.env' });

const prodUrl = process.env.TURSO_DATABASE_URL;
const prodToken = process.env.TURSO_AUTH_TOKEN;
if (!prodUrl) throw new Error('TURSO_DATABASE_URL missing em .env');
if (prodUrl.startsWith('file:')) {
    throw new Error(`.env aponta para arquivo local (${prodUrl}) — este script precisa apontar para o Turso prod.`);
}

const LOCAL_PATH = 'temp/database.db';
const LOCAL_URL = `file:./${LOCAL_PATH}`;

// Garante diretório
if (!existsSync(dirname(LOCAL_PATH))) mkdirSync(dirname(LOCAL_PATH), { recursive: true });

const prod = createClient({ url: prodUrl, authToken: prodToken });
const local = createClient({ url: LOCAL_URL });

const BATCH_SIZE = 100;

async function listUserTables(c: Client): Promise<string[]> {
    const res = await c.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
    return (res.rows as any[]).map(r => r.name as string).filter(n => n !== '_migrations');
}

async function main() {
    console.log(`→ SOURCE (prod):  ${prodUrl}`);
    console.log(`→ TARGET (local): ${LOCAL_URL}`);
    console.log('');

    const prodTables = await listUserTables(prod);
    const localTables = new Set(await listUserTables(local));

    console.log(`→ ${prodTables.length} tabelas em prod: ${prodTables.join(', ')}`);
    const missing = prodTables.filter(t => !localTables.has(t));
    if (missing.length > 0) {
        console.error(`\n✗ Tabelas faltando no local: ${missing.join(', ')}`);
        console.error(`  Rode 'npm run db:migrate' primeiro (com .env.development apontando para o file local).`);
        process.exit(1);
    }

    for (const table of prodTables) {
        const prodCount = await prod.execute(`SELECT COUNT(*) AS n FROM "${table}"`);
        const total = Number((prodCount.rows[0] as any).n);

        // Descobre colunas
        const cols = (await prod.execute(`SELECT * FROM "${table}" LIMIT 0`)).columns;

        await local.execute(`DELETE FROM "${table}"`);

        if (total === 0) {
            console.log(`  · ${table.padEnd(20)} 0 linhas — limpo.`);
            continue;
        }

        // Copia em batches
        let copied = 0;
        for (let offset = 0; offset < total; offset += BATCH_SIZE) {
            const page = await prod.execute({
                sql: `SELECT * FROM "${table}" LIMIT ? OFFSET ?`,
                args: [BATCH_SIZE, offset],
            });
            const placeholders = cols.map(() => '?').join(', ');
            const colList = cols.map(c => `"${c}"`).join(', ');

            for (const row of page.rows as any[]) {
                const args = cols.map(c => {
                    const v = row[c];
                    if (v === undefined) return null;
                    return v as any;
                });
                await local.execute({
                    sql: `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
                    args,
                });
                copied++;
            }
        }
        console.log(`  ✓ ${table.padEnd(20)} ${copied} linhas copiadas.`);
    }

    console.log('\n✓ Sync concluído. Local reflete o estado atual de prod.');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
