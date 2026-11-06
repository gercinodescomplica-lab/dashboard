import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { cenario } = await import('@/db/carteira.test-dados');
const { moverClientes } = await import('@/db/carteira');
const { syncPlannerTasks } = await import('./planner-sync');

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('Planner casa pela carteira', () => {
    it('tarefa existente de cliente movido vai para o card da carteira nova e grava cliente_id', async () => {
        await moverClientes(['c-smt'], 'GRC4', 'Admin');
        const r = await syncPlannerTasks([{ id: 'planner-1', title: 'SMT - Sistema', percentComplete: '0' }]);
        expect(r.updated).toBe(1);
        const [linha] = await db.select().from(s.cx);
        expect([linha.managerId, linha.clienteId]).toEqual(['grc4-beatriz', 'c-smt']);
    });
    it('sigla sem carteira fica em unmatched', async () => {
        const r = await syncPlannerTasks([{ id: 'p-2', title: 'SMC - Algo', percentComplete: '0' }]);
        expect(r.unmatched.map((u) => u.acronym)).toEqual(['SMC']);
    });
});
