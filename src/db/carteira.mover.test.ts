// src/db/carteira.mover.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('./carteira.test-dados');
const c = await import('./carteira');
const { MUDOU_ENQUANTO_OLHAVA, JUSTIFICATIVA_TROCA } = await import('@/lib/carteira/tipos');

const carteiraDe = async (id: string) => (await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, id)))[0]?.gerencia ?? null;

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('moverClientes leva tudo', () => {
    it('contrato, proposta, cx e projeto manual vão para o card da gerência nova; lead GRCC fica', async () => {
        expect(await c.moverClientes(['c-smt'], 'GRC4', 'Admin', { 'c-smt': 'GRC3' })).toEqual({ movidos: 1 });
        expect(await carteiraDe('c-smt')).toBe('GRC4');
        expect((await db.select().from(s.contrato))[0]).toMatchObject({ managerId: 'grc4-beatriz', gerencia: 'GRC-4', nomeGerente: 'Beatriz' });
        expect((await db.select().from(s.proposta))[0]).toMatchObject({ managerId: 'grc4-beatriz', gerencia: 'GRC-4' });
        expect((await db.select().from(s.cx))[0].managerId).toBe('grc4-beatriz');
        const projs = await db.select().from(s.projects);
        const manual = projs.find((p) => p.name === 'Projeto SMT')!;
        expect(manual.managerId).toBe('grc4-beatriz');
        expect(JSON.parse(manual.history!)).toEqual([expect.objectContaining({ tipo: 'nota', de: 'GRC3', para: 'GRC4', justificativa: JUSTIFICATIVA_TROCA, autor: 'Admin' })]);
        expect(projs.find((p) => p.name === 'Lead SMT')!.managerId).toBe('grcc-debora');
        const trilha = await db.select().from(s.movimentoCarteira);
        expect(trilha.map((m) => [m.clienteId, m.deGerencia, m.paraGerencia, m.por])).toEqual([['c-smt', 'GRC3', 'GRC4', 'Admin']]);
    });

    it('history JSON válido mas não-array não reverte o movimento', async () => {
        await db.update(s.projects).set({ history: '{"a":1}' }).where(eq(s.projects.name, 'Projeto SMT'));
        expect(await c.moverClientes(['c-smt'], 'GRC4', 'Admin')).toEqual({ movidos: 1 });
        const [p] = await db.select().from(s.projects).where(eq(s.projects.name, 'Projeto SMT'));
        expect(p.managerId).toBe('grc4-beatriz');
        expect(JSON.parse(p.history!)).toHaveLength(1);
    });

    it('desfazer é o movimento de volta', async () => {
        await c.moverClientes(['c-smt'], 'GRC4', 'Admin', { 'c-smt': 'GRC3' });
        await c.moverClientes(['c-smt'], 'GRC3', 'Admin', { 'c-smt': 'GRC4' });
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc3-barone');
        expect(await db.select().from(s.movimentoCarteira)).toHaveLength(2);
    });

    it('tirar da carteira não mexe nos dados', async () => {
        await c.moverClientes(['c-smt'], null, 'Admin', { 'c-smt': 'GRC3' });
        expect(await carteiraDe('c-smt')).toBeNull();
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc3-barone');
    });

    it('recusa: mudou enquanto olhava, gerência oculta, gerência inexistente — sem gravar', async () => {
        await expect(c.moverClientes(['c-smt'], 'GRC4', 'Admin', { 'c-smt': 'GRC1' })).rejects.toThrow(MUDOU_ENQUANTO_OLHAVA);
        await expect(c.moverClientes(['c-smt'], 'KAM10', 'Admin')).rejects.toThrow('Gerência desativada não recebe clientes.');
        await expect(c.moverClientes(['c-smt'], 'GRC9', 'Admin')).rejects.toThrow('Gerência não encontrada.');
        expect(await carteiraDe('c-smt')).toBe('GRC3');
        expect(await db.select().from(s.movimentoCarteira)).toHaveLength(0);
    });

    it('mesmo lugar: movidos 0', async () => {
        expect(await c.moverClientes(['c-smt'], 'GRC3', 'Admin')).toEqual({ movidos: 0 });
    });
});

describe('alterarCarteira (editor do admin)', () => {
    it('põe cliente sem carteira (levando os dados) e tira cliente da própria', async () => {
        await db.update(s.contrato).set({ clienteId: 'c-smc' });
        await c.alterarCarteira('GRC1', { adicionar: ['c-smc'], remover: [] }, 'Admin');
        expect(await carteiraDe('c-smc')).toBe('GRC1');
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc1-bruno');
        await c.alterarCarteira('GRC1', { adicionar: [], remover: ['c-smc'] }, 'Admin');
        expect(await carteiraDe('c-smc')).toBeNull();
    });
    it('cliente de outra gerência recusa tudo', async () => {
        await expect(c.alterarCarteira('GRC1', { adicionar: ['c-smt', 'c-smc'], remover: [] }, 'Admin')).rejects.toThrow('Cliente de outra gerência: mova pela aba Organograma.');
        expect(await carteiraDe('c-smc')).toBeNull();
    });
});

describe('alinharCliente (fora da carteira)', () => {
    it('traz os dados para a gerência da carteira e registra de onde vieram', async () => {
        await db.update(s.carteiraCliente).set({ gerencia: 'GRC1' }).where(eq(s.carteiraCliente.clienteId, 'c-smt'));
        expect(await c.gerenciasDosDados('c-smt')).toEqual(['GRC3']);
        await c.alinharCliente('c-smt', 'Admin');
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc1-bruno');
        expect(await c.gerenciasDosDados('c-smt')).toEqual(['GRC1']);
        const [mv] = await db.select().from(s.movimentoCarteira);
        expect([mv.deGerencia, mv.paraGerencia]).toEqual(['GRC3', 'GRC1']);
    });
});
