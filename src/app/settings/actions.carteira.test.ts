import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('@/db/carteira.test-dados');
const { juntarClientes, moverClientes, roteadorDaCarteira } = await import('@/db/carteira');
const { mesclarCX, mesclarPipeline } = await import('@/lib/carteira/mesclar-editor');
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

describe('GRCC: a página /grcc depende do role exato', () => {
    const debora = async () => (await fetchAllManagersFromDB()).find((m) => m.id === 'grcc-debora')!;
    it.each(['GRC-C', 'Triade', 'GRC8'])('recusa role %s', async (role) => {
        expect(await saveManagerData('adm', { ...(await debora()), role })).toEqual({ success: false, erro: 'A sigla da GRCC não pode mudar: a página /grcc depende dela.' });
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grcc-debora')))[0].role).toBe('GRCC');
    });
    it('role igual salva', async () => {
        expect(await saveManagerData('adm', { ...(await debora()), name: 'Débora Lima' })).toEqual({ success: true });
    });
});

describe('salvar não perde linha', () => {
    const card = async (id: string) => (await fetchAllManagersFromDB()).find((m) => m.id === id)!;

    it('destino salvo com o estado mesclado mantém projeto e CX que chegaram', async () => {
        const velho = await card('grc4-beatriz');
        const cxVelho = await fetchCXByManager('grc4-beatriz');
        await moverClientes(['c-smt'], 'GRC4', 'Admin', { 'c-smt': 'GRC3' });
        const pipeline = mesclarPipeline(velho.pipeline, (await card('grc4-beatriz')).pipeline);
        const cxMesclado = mesclarCX(cxVelho, await fetchCXByManager('grc4-beatriz'))!;
        await saveManagerData('adm', { ...velho, pipeline });
        await saveCXData('adm', 'grc4-beatriz', cxMesclado);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Projeto SMT')))).toEqual([expect.objectContaining({ managerId: 'grc4-beatriz', clienteId: 'c-smt' })]);
        expect(await db.select().from(s.cx)).toEqual([expect.objectContaining({ managerId: 'grc4-beatriz', clienteId: 'c-smt', externalId: 'planner-1' })]);
    });

    it('projeto com cliente apagado não perde linhas: recasa pelo texto ou fica sem cliente', async () => {
        const bruno = await card('grc1-bruno');
        bruno.pipeline.q1.projects.push({ name: 'Recasa', value: 1, orgao: 'SMC', clienteId: 'apagado' }, { name: 'Sem par', value: 1, orgao: 'Câmara X', clienteId: 'apagado' });
        expect(await saveManagerData('adm', bruno)).toEqual({ success: true });
        const projs = await db.select().from(s.projects).where(eq(s.projects.managerId, 'grc1-bruno'));
        expect(projs.map((p) => [p.name, p.clienteId]).sort()).toEqual([['Recasa', 'c-smc'], ['Sem par', null]]);
    });

    it('CX com cliente apagado não perde linhas: recasa pelo texto ou fica sem cliente', async () => {
        const base = { problema: 'p', solucaoProposta: 's', status: 'pendente' as const };
        await saveCXData('adm', 'grc1-bruno', [{ ...base, cliente: 'SMC', titulo: 'Recasa', clienteId: 'apagado' }, { ...base, cliente: 'Câmara X', titulo: 'Sem par', clienteId: 'apagado' }]);
        const linhas = await db.select().from(s.cx).where(eq(s.cx.managerId, 'grc1-bruno'));
        expect(linhas.map((c) => [c.titulo, c.clienteId]).sort()).toEqual([['Recasa', 'c-smc'], ['Sem par', null]]);
    });

    it('estado velho depois de juntar clientes não perde as linhas do card', async () => {
        const velho = await card('grc3-barone');
        const cxVelho = await fetchCXByManager('grc3-barone');
        await juntarClientes('c-smt', 'c-sme', 'Admin');
        await saveManagerData('adm', velho);
        await saveCXData('adm', 'grc3-barone', cxVelho);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Projeto SMT')))).toHaveLength(1);
        expect(await db.select().from(s.cx)).toHaveLength(1);
    });

    it('insert que falha desfaz o delete de projetos', async () => {
        const barone = await card('grc3-barone');
        barone.pipeline.q2.projects.push({ name: null as unknown as string, value: 1 });
        await expect(saveManagerData('adm', barone)).rejects.toThrow('Erro ao salvar gerente no Turso.');
        expect(await db.select().from(s.projects).where(eq(s.projects.name, 'Projeto SMT'))).toHaveLength(1);
    });

    it('insert que falha desfaz o delete de CX', async () => {
        const invalido = { cliente: 'X', titulo: 't', problema: null as unknown as string, solucaoProposta: 's', status: 'pendente' as const };
        await expect(saveCXData('adm', 'grc3-barone', [invalido])).rejects.toThrow('Erro ao salvar CX no Turso.');
        expect((await db.select().from(s.cx)).map((c) => c.externalId)).toEqual(['planner-1']);
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
