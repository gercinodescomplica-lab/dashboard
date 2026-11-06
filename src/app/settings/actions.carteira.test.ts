import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('@/db/carteira.test-dados');
const { moverClientes, roteadorDaCarteira } = await import('@/db/carteira');
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

describe('linha criada no editor ganha cliente pelo texto', () => {
    it('projeto novo SEM clienteId casa pelo órgão e vai para o card da carteira', async () => {
        const bruno = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc1-bruno')!;
        bruno.pipeline.q2.projects.push({ name: 'Novo SME', value: 10, orgao: 'SME' });
        await saveManagerData('adm', bruno);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Novo SME')))[0]).toMatchObject({ managerId: 'kam1-malde', clienteId: 'c-sme' });
    });
    it('projeto com texto que não casa fica sem cliente no próprio card', async () => {
        const bruno = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc1-bruno')!;
        bruno.pipeline.q2.projects.push({ name: 'Solto', value: 10, orgao: 'Câmara X' });
        await saveManagerData('adm', bruno);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Solto')))[0]).toMatchObject({ managerId: 'grc1-bruno', clienteId: null });
    });
    it('projeto de lead que vem do editor continua de fora', async () => {
        const debora = (await fetchAllManagersFromDB()).find((m) => m.id === 'grcc-debora')!;
        await saveManagerData('adm', debora);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Lead SMT')))).toHaveLength(1);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Lead SMT')))[0].managerId).toBe('grcc-debora');
    });
    it('CX novo SEM clienteId casa pelo cliente e vai para o card da carteira', async () => {
        await saveCXData('adm', 'grc1-bruno', [{ cliente: 'SME', titulo: 'Novo', problema: 'p', solucaoProposta: 's', status: 'pendente' }]);
        expect((await db.select().from(s.cx).where(eq(s.cx.titulo, 'Novo')))[0]).toMatchObject({ managerId: 'kam1-malde', clienteId: 'c-sme' });
    });
    it('e acompanha o movimento da carteira depois', async () => {
        const bruno = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc1-bruno')!;
        bruno.pipeline.q2.projects.push({ name: 'Novo SME', value: 10, orgao: 'SME' });
        await saveManagerData('adm', bruno);
        await moverClientes(['c-sme'], 'GRC4', 'Admin');
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Novo SME')))[0].managerId).toBe('grc4-beatriz');
    });
});

describe('editor de gerente não fura D5/D10', () => {
    const card = async (id: string) => (await fetchAllManagersFromDB()).find((m) => m.id === id)!;
    const linha = async (id: string) => (await db.select().from(s.managers).where(eq(s.managers.id, id)))[0];

    it('recusa mudar a sigla do card existente e não grava nada', async () => {
        const barone = await card('grc3-barone');
        expect(await saveManagerData('adm', { ...barone, role: 'GRC9', name: 'Outro' })).toEqual({ success: false, erro: 'Para mudar a sigla, use Organograma de clientes.' });
        expect(await linha('grc3-barone')).toMatchObject({ role: 'GRC3', name: 'Barone' });
    });
    it('aceita outra grafia da mesma chave', async () => {
        const barone = await card('grc3-barone');
        expect(await saveManagerData('adm', { ...barone, role: 'GRC-3' })).toEqual({ success: true });
    });
    it('recusa ocultar o card da gerência com clientes', async () => {
        const barone = await card('grc3-barone');
        expect(await saveManagerData('adm', { ...barone, showInDashboard: false })).toEqual({ success: false, erro: 'Tire os 2 clientes da carteira antes de desativar.' });
        expect((await linha('grc3-barone')).showInDashboard).toBe(true);
    });
    it('oculta gerência sem clientes e card antigo que não é o da gerência', async () => {
        await db.insert(s.carteiraCliente).values({ clienteId: 'c-smc', gerencia: 'GRC4', movidoEm: 'x' });
        expect(await saveManagerData('adm', { ...(await card('grc1-bruno')), showInDashboard: false })).toEqual({ success: true });
        expect(await saveManagerData('adm', { ...(await card('grc4-velha')), showInDashboard: false })).toEqual({ success: true });
    });
    it('card novo não é afetado', async () => {
        const barone = await card('grc3-barone');
        const novo = { ...barone, id: 'grc9-nova', role: 'GRC9', showInDashboard: false, pipeline: { q1: { total: 0, projects: [] }, q2: { total: 0, projects: [] }, q3: { total: 0, projects: [] }, q4: { total: 0, projects: [] }, nao_mapeado: { total: 0, projects: [] } } };
        expect(await saveManagerData('adm', novo)).toEqual({ success: true });
        expect((await linha('grc9-nova')).role).toBe('GRC9');
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

describe('roteadorDaCarteira (lote de managerDaLinha)', () => {
    it('troca só quando a carteira é de outra gerência', async () => {
        const rotear = await roteadorDaCarteira();
        expect(rotear('c-smt', 'grc1-bruno')).toBe('grc3-barone');
        expect(rotear('c-smt', 'grc3-barone')).toBe('grc3-barone');
        expect(rotear('c-smc', 'grc1-bruno')).toBe('grc1-bruno');
        expect(rotear(null, 'grc1-bruno')).toBe('grc1-bruno');
        expect(rotear('c-smt', 'card-inexistente')).toBe('grc3-barone');
    });
});
