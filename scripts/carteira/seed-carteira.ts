// scripts/carteira/seed-carteira.ts
// Uso: npx tsx scripts/carteira/seed-carteira.ts   (usa TURSO_DATABASE_URL do .env/.env.development)
// Rode primeiro numa CÓPIA local; produção só com ordem explícita do usuário.
import { config } from 'dotenv';
import { existsSync } from 'fs';

config({ path: '.env' });
if ((process.env.NODE_ENV ?? 'development') !== 'production' && existsSync('.env.development')) config({ path: '.env.development', override: true });

async function main() {
    console.log(`→ carga da carteira em ${process.env.TURSO_DATABASE_URL}`);
    const { semearCarteira } = await import('../../src/db/carteira-seed');
    const r = await semearCarteira();
    console.log(JSON.stringify({ ...r, fora: r.fora.map((f) => `${f.sigla ?? f.nome}: carteira ${f.carteira}, dados em ${f.gerenciasDosDados.join(', ')}`) }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
