// src/db/carteira.admin.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('./carteira.test-dados');
const c = await import('./carteira');

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('gerência', () => {
    it('criarGerencia: card novo com a chave como role, maior ano e visível; sigla repetida recusa', async () => {
        expect(await c.criarGerencia({ sigla: 'grc-5', nome: 'Ana Souza' })).toEqual({ chave: 'GRC5', id: 'grc5-ana-souza' });
        const [card] = await db.select().from(s.managers).where(eq(s.managers.id, 'grc5-ana-souza'));
        expect(card).toMatchObject({ name: 'Ana Souza', role: 'GRC5', year: 2026, showInDashboard: true, meta: 0 });
        await expect(c.criarGerencia({ sigla: 'GRC3', nome: 'X' })).rejects.toThrow('Já existe uma gerência com a sigla GRC3.');
    });

    it('editarGerencia: troca a sigla em todos os cards, na carteira, na trilha e no texto de contrato/proposta', async () => {
        expect(await c.editarGerencia('GRC3', { sigla: 'GRC7', nome: 'Barone Filho' })).toEqual({ chave: 'GRC7' });
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc3-barone')))[0]).toMatchObject({ role: 'GRC7', name: 'Barone Filho' });
        expect((await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, 'c-smt')))[0].gerencia).toBe('GRC7');
        expect((await db.select().from(s.contrato))[0].gerencia).toBe('GRC-7');
        expect((await db.select().from(s.proposta))[0].gerencia).toBe('GRC-7');
        await expect(c.editarGerencia('GRC7', { sigla: 'GRC1', nome: 'x' })).rejects.toThrow('Já existe uma gerência com a sigla GRC1.');
    });

    it('editarGerencia: recusa sigla que o id do card contradiz, sem órfãos', async () => {
        await expect(c.editarGerencia('GRC3', { sigla: 'Triade', nome: 'Barone' })).rejects.toThrow('Essa sigla não pode ser usada nesta gerência: o id do card já indica outra.');
        expect((await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, 'c-smt')))[0].gerencia).toBe('GRC3');
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc3-barone')))[0].role).toBe('GRC3');
    });

    it('editarGerencia: sigla da GRCC não muda; o nome muda', async () => {
        await expect(c.editarGerencia('GRCC', { sigla: 'GRC8', nome: 'Débora' })).rejects.toThrow('A sigla da GRCC não pode mudar: a página /grcc depende dela.');
        expect(await c.editarGerencia('GRCC', { sigla: 'GRCC', nome: 'Débora Lima' })).toEqual({ chave: 'GRCC' });
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grcc-debora')))[0]).toMatchObject({ role: 'GRCC', name: 'Débora Lima' });
    });

    it('editarGerencia: mudar o nome atualiza contrato.nome_gerente; manter o nome preserva', async () => {
        await c.editarGerencia('GRC3', { sigla: 'GRC3', nome: 'Barone Filho' });
        expect((await db.select().from(s.contrato))[0].nomeGerente).toBe('Barone Filho');
        await db.update(s.contrato).set({ nomeGerente: 'Texto antigo' });
        await c.editarGerencia('GRC3', { sigla: 'GRC7', nome: 'Barone Filho' });
        expect((await db.select().from(s.contrato))[0].nomeGerente).toBe('Texto antigo');
    });

    it('ocultar com cliente recusa; sem cliente oculta; oculta volta', async () => {
        await expect(c.definirGerenciaVisivel('GRC3', false)).rejects.toThrow('Tire os 2 clientes da carteira antes de desativar.');
        await c.definirGerenciaVisivel('GRC1', false);
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc1-bruno')))[0].showInDashboard).toBe(false);
        await c.definirGerenciaVisivel('GRC1', true);
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc1-bruno')))[0].showInDashboard).toBe(true);
    });
});

describe('cliente', () => {
    it('ocultar mantém a carteira', async () => {
        await c.definirClienteAtivo('c-smt', false);
        expect((await db.select().from(s.cliente).where(eq(s.cliente.id, 'c-smt')))[0].ativo).toBe(false);
        expect((await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, 'c-smt')))[0].gerencia).toBe('GRC3');
    });
    it('criarCliente recusa sigla repetida', async () => {
        const { id } = await c.criarCliente({ nome: 'Câmara de Osasco', sigla: null });
        expect(id).toBeTruthy();
        await expect(c.criarCliente({ nome: 'Outra', sigla: 'smt' })).rejects.toThrow('Já existe um cliente com a sigla smt.');
    });
});

describe('a conferir', () => {
    it('foraDaCarteira lista cliente cujos dados estão em outra gerência', async () => {
        await db.update(s.carteiraCliente).set({ gerencia: 'GRC1' }).where(eq(s.carteiraCliente.clienteId, 'c-smt'));
        expect(await c.foraDaCarteira()).toEqual([{ clienteId: 'c-smt', sigla: 'SMT', nome: 'Secretaria Municipal de Transportes', carteira: 'GRC1', gerenciasDosDados: ['GRC3'] }]);
    });
    it('foraDaCarteira: vários clientes em lote, ordenados', async () => {
        await db.update(s.carteiraCliente).set({ gerencia: 'GRC1' }).where(eq(s.carteiraCliente.clienteId, 'c-smt'));
        await db.insert(s.contrato).values({ id: 'ct-sme', numeroContrato: '2/2025', cliente: 'SME', clienteId: 'c-sme', managerId: 'grc1-bruno' });
        expect(await c.foraDaCarteira()).toEqual([
            { clienteId: 'c-sme', sigla: 'SME', nome: 'Secretaria Municipal da Educação', carteira: 'KAM1', gerenciasDosDados: ['GRC1'] },
            { clienteId: 'c-smt', sigla: 'SMT', nome: 'Secretaria Municipal de Transportes', carteira: 'GRC1', gerenciasDosDados: ['GRC3'] },
        ]);
    });
    it('linhasSemCliente e ligarCliente; projeto de lead GRCC fica de fora', async () => {
        await db.insert(s.contrato).values({ id: 'ct-x', numeroContrato: '9/2025', cliente: 'Câmara X', managerId: 'grc1-bruno' });
        const linhas = await c.linhasSemCliente();
        expect(linhas).toEqual([{ tabela: 'contrato', id: 'ct-x', texto: 'Câmara X', gerencia: 'GRC1' }]);
        await expect(c.ligarCliente('contrato', 'nao-existe', 'c-smc')).rejects.toThrow('Linha não encontrada.');
        await c.ligarCliente('contrato', 'ct-x', 'c-smc');
        expect(await c.linhasSemCliente()).toEqual([]);
    });
    it('gerenciasParaEditar: uma por chave, com clientes (inclusive ocultos)', async () => {
        const g = (await c.gerenciasParaEditar()).find((x) => x.chave === 'GRC3')!;
        expect(g).toMatchObject({ cardId: 'grc3-barone', nome: 'Barone', visivel: true });
        expect(g.clientes.map((x) => [x.id, x.ativo])).toEqual([['c-oculto', false], ['c-smt', true]]);
    });
});
