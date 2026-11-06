import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('@/db/carteira.test-dados');
const { PATCH } = await import('./route');

const enviar = (corpo: unknown) => PATCH(new Request('http://x/api', { method: 'PATCH', headers: { authorization: 'Bearer k' }, body: JSON.stringify(corpo) }));

beforeAll(() => { process.env.EXTERNAL_API_KEY = 'k'; return applyMigrations(); });
beforeEach(() => cenario(db));

describe('update do bot não apaga vínculo com cliente', () => {
    it('CX: texto que não casa mantém o cliente', async () => {
        const [linha] = await db.select().from(s.cx);
        const r = await enviar({ managerId: 'grc3-barone', cx: { upsert: [{ id: linha.id, cliente: 'Texto sem cliente' }] } });
        expect(r.status).toBe(200);
        expect((await db.select().from(s.cx).where(eq(s.cx.id, linha.id)))[0]).toMatchObject({ cliente: 'Texto sem cliente', clienteId: 'c-smt' });
    });
    it('projeto: texto que não casa mantém; texto que casa troca', async () => {
        const [p] = await db.select().from(s.projects).where(eq(s.projects.name, 'Projeto SMT'));
        await enviar({ managerId: 'grc3-barone', projects: { upsert: [{ id: p.id, orgao: 'Texto sem cliente' }] } });
        expect((await db.select().from(s.projects).where(eq(s.projects.id, p.id)))[0].clienteId).toBe('c-smt');
        await enviar({ managerId: 'grc3-barone', projects: { upsert: [{ id: p.id, orgao: 'SME' }] } });
        expect((await db.select().from(s.projects).where(eq(s.projects.id, p.id)))[0].clienteId).toBe('c-sme');
    });
});
