// src/db/carteira.juntar.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario, AGORA } = await import('./carteira.test-dados');
const c = await import('./carteira');

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

const clientes = async () => (await db.select().from(s.cliente)).map((x) => x.id).sort();
const carteiraDe = async (id: string) => (await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, id)))[0]?.gerencia;

describe('juntarClientes', () => {
    it('move contrato, proposta, cx e projeto sem mudar o manager_id; apaga a origem; projeto de lead fica intacto', async () => {
        await c.juntarClientes('c-smt', 'c-sme', 'Admin');
        expect(await clientes()).not.toContain('c-smt');
        expect((await db.select().from(s.contrato))[0]).toMatchObject({ clienteId: 'c-sme', managerId: 'grc3-barone' });
        expect((await db.select().from(s.proposta))[0]).toMatchObject({ clienteId: 'c-sme', managerId: 'grc3-barone' });
        expect((await db.select().from(s.cx))[0]).toMatchObject({ clienteId: 'c-sme', managerId: 'grc3-barone' });
        const projs = await db.select().from(s.projects);
        expect(projs.find((p) => p.leadGrccId === null)).toMatchObject({ clienteId: 'c-sme', managerId: 'grc3-barone' });
        expect(projs.find((p) => p.leadGrccId === 1)).toMatchObject({ clienteId: null, managerId: 'grcc-debora' });
    });

    it('destino com carteira mantém a dele; sigla do destino também', async () => {
        await c.juntarClientes('c-smt', 'c-sme', 'Admin');
        expect(await carteiraDe('c-sme')).toBe('KAM1');
        expect((await db.select().from(s.cliente).where(eq(s.cliente.id, 'c-sme')))[0].sigla).toBe('SME');
    });

    it('destino sem carteira herda a da origem, com movimento; herda a sigla só se não tiver', async () => {
        await db.update(s.cliente).set({ sigla: null }).where(eq(s.cliente.id, 'c-smc'));
        await c.juntarClientes('c-smt', 'c-smc', 'Admin');
        expect(await carteiraDe('c-smc')).toBe('GRC3');
        expect((await db.select().from(s.cliente).where(eq(s.cliente.id, 'c-smc')))[0].sigla).toBe('SMT');
        const movs = await db.select().from(s.movimentoCarteira).where(eq(s.movimentoCarteira.clienteId, 'c-smc'));
        expect(movs).toEqual([expect.objectContaining({ deGerencia: null, paraGerencia: 'GRC3', por: 'Admin' })]);
    });

    it('movimentos da origem passam para o destino', async () => {
        await db.insert(s.movimentoCarteira).values({ clienteId: 'c-smt', deGerencia: null, paraGerencia: 'GRC3', por: 'x', em: AGORA });
        await c.juntarClientes('c-smt', 'c-sme', 'Admin');
        expect(await db.select().from(s.movimentoCarteira).where(eq(s.movimentoCarteira.clienteId, 'c-sme'))).toHaveLength(1);
    });

    it('mesmo id ou id inexistente recusa sem gravar', async () => {
        await expect(c.juntarClientes('c-smt', 'c-smt', 'Admin')).rejects.toThrow('Escolha dois clientes diferentes.');
        await expect(c.juntarClientes('c-smt', 'nao-existe', 'Admin')).rejects.toThrow('Cliente não encontrado.');
        await expect(c.juntarClientes('nao-existe', 'c-smt', 'Admin')).rejects.toThrow('Cliente não encontrado.');
        expect(await clientes()).toContain('c-smt');
        expect((await db.select().from(s.contrato))[0].clienteId).toBe('c-smt');
    });

    it('com carteira diferente, o cliente passa a aparecer em Fora da carteira', async () => {
        await c.juntarClientes('c-smt', 'c-sme', 'Admin');
        expect(await c.foraDaCarteira()).toEqual([expect.objectContaining({ clienteId: 'c-sme', carteira: 'KAM1', gerenciasDosDados: ['GRC3'] })]);
    });
});
