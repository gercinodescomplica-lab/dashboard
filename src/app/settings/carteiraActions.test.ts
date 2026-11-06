import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const { db, applyMigrations } = await createTransactionSafeTestDb();
const { cenario } = await import('@/db/carteira.test-dados');
const a = await import('./carteiraActions');

beforeAll(() => { process.env.SETTINGS_KEY = 'adm'; return applyMigrations(); });
beforeEach(() => cenario(db));

describe('carteiraActions', () => {
    it('sem chave: recusa e não grava', async () => {
        expect(await a.moverClienteNoOrganogramaAction('errada', 'c-smt', 'GRC3', 'GRC4')).toEqual({ ok: false, erro: 'Só o administrador move clientes entre carteiras.' });
        expect(await a.criarGerenciaAction('', { sigla: 'GRC5', nome: 'X' })).toMatchObject({ ok: false });
    });
    it('move, devolve o resultado e traduz o erro de regra', async () => {
        expect(await a.moverClienteNoOrganogramaAction('adm', 'c-smt', 'GRC3', 'GRC4')).toEqual({ ok: true, valor: { movidos: 1 } });
        expect(await a.moverClienteNoOrganogramaAction('adm', 'c-smt', 'GRC3', 'GRC1')).toEqual({ ok: false, erro: 'Esse cliente mudou de carteira enquanto você olhava. A tela foi atualizada.' });
        expect(await a.moverClienteNoOrganogramaAction('adm', 'c-smt', 'GRC4', 'GRC4')).toEqual({ ok: true, valor: { movidos: 0 } });
    });
    it('criarELigarCliente: cria, liga; chave errada recusa', async () => {
        expect(await a.criarELigarClienteAction('errada', 'contrato', 'ct-smt', { nome: 'Novo', sigla: null })).toMatchObject({ ok: false });
        const r = await a.criarELigarClienteAction('adm', 'contrato', 'ct-smt', { nome: 'Novo', sigla: null });
        expect(r.ok).toBe(true);
        const falha = await a.criarELigarClienteAction('adm', 'contrato', 'nao-existe', { nome: 'Outro', sigla: null });
        if (!falha.ok) expect(falha.erro).toMatch(/Cliente criado, mas não foi possível ligar/);
    });
    it('entrada inválida', async () => {
        expect(await a.moverClienteNoOrganogramaAction('adm', '', 'GRC3', 'GRC4')).toEqual({ ok: false, erro: 'Dados inválidos.' });
    });
    it('painel do admin e leitura aberta', async () => {
        const p = await a.carregarPainelCarteiraAction('adm');
        expect(p.ok && p.valor.semCarteira.map((c) => c.id)).toEqual(['c-smc']);
        expect((await a.carregarOrganogramaClientesAction()).totais.orgaosAtendidos).toBe(2);
    });
});
