import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { proposta } from '../../src/db/schema';
import { sql } from 'drizzle-orm';

config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    console.error('TURSO_DATABASE_URL não definido.');
    process.exit(1);
}

const client = createClient({ url, authToken });
const db = drizzle({ connection: { url, authToken } });

const GERENCIA_PARA_MANAGER_ID: Record<string, string> = {
    'GRC-1': 'grc1-bruno',
    'GRC-2': 'grc2-paulo',
    'GRC-3': 'grc3-barone',
    'GRC-4': 'grc4-beatriz',
    'GRC-C': 'grcc-debora',
    'KAM-1': 'kam1-malde',
    'KAM-2': 'kam2-betone',
    'KAM-3': 'kam3-andrea',
    'KAM-4': 'kam4-tomiatto',
};

type Row = {
    gerencia: string | null;
    nomeOportunidade: string | null;
    proprietario: string | null;
    numeroProposta: string | null;
    cliente: string | null;
    fase: string | null;
    valor: number | null;
    receitaEsperada: number | null;
    probabilidade: number | null;
    duracao: number | null;
    dataCriacao: string | null;
    dataFechamento: string | null;
};

async function main() {
    const jsonPath = path.resolve(process.cwd(), 'scripts/propostas/propostas.json');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const rows: Row[] = JSON.parse(raw);
    console.log(`Lidas ${rows.length} propostas do JSON.`);

    await client.execute('DELETE FROM proposta');
    console.log('Tabela proposta limpa.');

    let inserted = 0;
    for (const r of rows) {
        if (!r.numeroProposta || !r.cliente || !r.nomeOportunidade) continue;
        const managerId = r.gerencia ? GERENCIA_PARA_MANAGER_ID[r.gerencia] ?? null : null;
        const now = new Date().toISOString();
        await db.insert(proposta).values({
            id: randomUUID(),
            numeroProposta: r.numeroProposta,
            nomeOportunidade: r.nomeOportunidade,
            proprietario: r.proprietario,
            cliente: r.cliente,
            fase: r.fase,
            valor: r.valor,
            receitaEsperada: r.receitaEsperada,
            probabilidade: r.probabilidade,
            duracao: r.duracao,
            dataCriacao: r.dataCriacao,
            dataFechamento: r.dataFechamento,
            gerencia: r.gerencia,
            managerId,
            createdAt: now,
            updatedAt: now,
        });
        inserted++;
    }
    console.log(`✓ ${inserted} propostas inseridas.`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
