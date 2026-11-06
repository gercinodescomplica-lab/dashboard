import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import * as s from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cenario } from '@/db/carteira.test-dados';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const { createContratoAction, updateContratoAction } = await import('./actions');
const { createPropostaAction } = await import('@/app/proposals/actions');

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('contrato e proposta com cliente em carteira', () => {
    it('update: gerência e gerente da carteira por cima do formulário', async () => {
        await updateContratoAction('ct-smt', { managerId: 'grc1-bruno', gerencia: 'GRC-1', nomeGerente: 'Bruno', objeto: 'editado' });
        expect((await db.select().from(s.contrato).where(eq(s.contrato.id, 'ct-smt')))[0]).toMatchObject({ managerId: 'grc3-barone', gerencia: 'GRC-3', nomeGerente: 'Barone', objeto: 'editado' });
    });
    it('update com clienteId null casa de novo pelo texto e mantém a carteira', async () => {
        await updateContratoAction('ct-smt', { clienteId: null, managerId: 'grc1-bruno' });
        expect((await db.select().from(s.contrato).where(eq(s.contrato.id, 'ct-smt')))[0]).toMatchObject({ clienteId: 'c-smt', managerId: 'grc3-barone' });
    });
    it('create: casa o cliente pelo texto e usa a carteira; sem carteira vale o formulário', async () => {
        await createContratoAction({ id: 'ct-novo', numeroContrato: '2/2026', cliente: 'SME', managerId: 'grc1-bruno', gerencia: 'GRC-1' });
        expect((await db.select().from(s.contrato).where(eq(s.contrato.id, 'ct-novo')))[0]).toMatchObject({ clienteId: 'c-sme', managerId: 'kam1-malde', gerencia: 'KAM-1' });
        await createPropostaAction({ id: 'pr-novo', numeroProposta: 'P9', nomeOportunidade: 'X', cliente: 'SMC', managerId: 'grc1-bruno', gerencia: 'GRC-1' });
        expect((await db.select().from(s.proposta).where(eq(s.proposta.id, 'pr-novo')))[0]).toMatchObject({ clienteId: 'c-smc', managerId: 'grc1-bruno', gerencia: 'GRC-1' });
    });
});
