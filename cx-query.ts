import 'dotenv/config';
import { db } from './src/db/index';
import { cx, managers } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const results = await db
        .select({
            gerente: managers.name,
            orgao: cx.cliente,
            titulo: cx.titulo,
            problema: cx.problema,
            solucaoProposta: cx.solucaoProposta,
            status: cx.status
        })
        .from(cx)
        .innerJoin(managers, eq(cx.managerId, managers.id));

    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
