// scripts/carteira/seed-carteira.ts
// Uso local:  npx tsx scripts/carteira/seed-carteira.ts          (banco file: local)
// Uso remoto: npx tsx scripts/carteira/seed-carteira.ts --prod   (só com ordem explícita do usuário)
// Rode primeiro numa CÓPIA local.
import { config } from 'dotenv';
import { existsSync } from 'fs';

config({ path: '.env' });
if ((process.env.NODE_ENV ?? 'development') !== 'production' && existsSync('.env.development')) config({ path: '.env.development', override: true });

const url = process.env.TURSO_DATABASE_URL ?? '';
if (!url.startsWith('file:') && !process.argv.includes('--prod')) {
    console.error(`Banco remoto (${url}): rode com --prod para confirmar que é para gravar em ${url}.`);
    process.exit(1);
}

async function main() {
    console.log(`→ carga da carteira em ${process.env.TURSO_DATABASE_URL}`);
    const { semearCarteira } = await import('../../src/db/carteira-seed');
    const r = await semearCarteira();
    console.log(JSON.stringify({ ...r, fora: r.fora.map((f) => `${f.sigla ?? f.nome}: carteira ${f.carteira}, dados em ${f.gerenciasDosDados.join(', ')}`) }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
