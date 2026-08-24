import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { existsSync } from 'fs';

loadEnv({ path: '.env' });
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'production' && existsSync('.env.development')) {
    loadEnv({ path: '.env.development', override: true });
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error('TURSO_DATABASE_URL missing');

// Dry-run by default (só mostra quantos registros seriam apagados) — precisa
// de --confirm pra apagar de verdade. Mesmo padrão de segurança do
// scripts/import-cx-planner.ts (que usa --apply).
const confirm = process.argv.includes('--confirm');
const managerArg = process.argv.find((a) => a.startsWith('--manager='));
const managerId = managerArg ? managerArg.slice('--manager='.length) : null;

const client = createClient({ url, authToken });

async function main() {
    console.log(`→ ${confirm ? 'APAGANDO' : 'DRY-RUN'} contra ${url} (NODE_ENV=${nodeEnv})`);

    const where = managerId ? ' WHERE manager_id = ?' : '';
    const args = managerId ? [managerId] : [];

    const countRes = await client.execute({ sql: `SELECT COUNT(*) as n FROM cx${where}`, args });
    const count = Number((countRes.rows[0] as { n: number | string }).n);
    console.log(`→ ${count} registro(s) de CX ${managerId ? `do gerente "${managerId}"` : '(todos os gerentes)'} encontrados`);

    if (count === 0) {
        console.log('Nada a apagar.');
        process.exit(0);
    }

    if (!confirm) {
        console.log('\n(dry-run — nada foi apagado. Rode novamente com --confirm para apagar de verdade.)');
        console.log('Exemplos:');
        console.log('  npm run cx:clear -- --confirm                     # apaga TODOS os gerentes');
        console.log('  npm run cx:clear -- --manager=grc1-andrea --confirm # apaga só de um gerente');
        process.exit(0);
    }

    await client.execute({ sql: `DELETE FROM cx${where}`, args });
    console.log(`✓ ${count} registro(s) apagado(s).`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
