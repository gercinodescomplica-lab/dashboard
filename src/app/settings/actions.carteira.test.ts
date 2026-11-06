import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('@/db/carteira.test-dados');
const { moverClientes } = await import('@/db/carteira');
const { saveManagerData, saveCXData, cloneManager } = await import('./actions');
const { fetchAllManagersFromDB, fetchCXByManager } = await import('@/db/queries');

beforeAll(() => { process.env.SETTINGS_KEY = 'adm'; return applyMigrations(); });
beforeEach(() => cenario(db));

describe('editor aberto com dado velho não desfaz a troca', () => {
    it('saveManagerData do card antigo não devolve nem duplica o projeto movido', async () => {
        const velho = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc3-barone')!;
        expect(velho.pipeline.q1.projects[0]).toMatchObject({ name: 'Projeto SMT', clienteId: 'c-smt' });
        await moverClientes(['c-smt'], 'GRC4', 'Admin');
        await saveManagerData('adm', velho);
        const projs = await db.select().from(s.projects).where(eq(s.projects.name, 'Projeto SMT'));
        expect(projs.map((p) => p.managerId)).toEqual(['grc4-beatriz']);
    });
    it('saveCXData do card antigo não devolve nem duplica o CX movido', async () => {
        const velhos = await fetchCXByManager('grc3-barone');
        expect(velhos[0].clienteId).toBe('c-smt');
        await moverClientes(['c-smt'], 'GRC4', 'Admin');
        await saveCXData('adm', 'grc3-barone', velhos);
        expect((await db.select().from(s.cx)).map((r) => r.managerId)).toEqual(['grc4-beatriz']);
    });
    it('projeto novo de cliente de outra carteira vai para o card da carteira', async () => {
        const bruno = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc1-bruno')!;
        bruno.pipeline.q2.projects.push({ name: 'Novo SME', value: 10, orgao: 'SME', clienteId: 'c-sme' });
        await saveManagerData('adm', bruno);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Novo SME')))[0].managerId).toBe('kam1-malde');
    });
});

describe('servedClients vem da carteira', () => {
    it('fetchAllManagersFromDB monta servedClients pela gerência; saveManagerData não grava served_clients', async () => {
        const barone = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc3-barone')!;
        expect(barone.servedClients).toEqual(['SMT (Secretaria Municipal de Transportes)']);
        await saveManagerData('adm', { ...barone, servedClients: ['HACK'] });
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc3-barone')))[0].servedClients).toBeNull();
    });
    it('cloneManager não copia served_clients e mantém cliente_id', async () => {
        const { newId } = await cloneManager('adm', 'grc3-barone', 'Clone');
        const [card] = await db.select().from(s.managers).where(eq(s.managers.id, newId));
        expect(card.servedClients).toBeNull();
        expect((await db.select().from(s.projects).where(eq(s.projects.managerId, newId)))[0].clienteId).toBe('c-smt');
    });
});
