import { describe, it, expect, beforeAll } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO } from '@/lib/grcc/tipos';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const q = await import('@/db/queries');
const { saveManagerData, cloneManager } = await import('./actions');
const { eq, isNull, isNotNull } = await import('drizzle-orm');

beforeAll(async () => {
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026, avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 });
    await q.salvarLeadGrcc(null, { ...LEAD_VAZIO, cliente: 'ALESP', solicitacao: 'Chatbot', categoria: 'No cliente', valor: 10, previsaoFechamento: '2026-08-01' });
    await db.insert(s.projects).values({ managerId: 'grcc-debora', quarter: 'q1', name: 'Manual', value: 5, temperature: 'morno' });
});

describe('projetos gerados pela GRCC', () => {
    it('aparecem no pipeline com leadGrccId', async () => {
        const [deb] = (await q.fetchAllManagersFromDB()).filter((m) => m.id === 'grcc-debora');
        expect(deb.pipeline.q3.projects[0]).toMatchObject({ name: 'Chatbot', leadGrccId: expect.any(Number) });
        expect(deb.pipeline.q1.projects[0].leadGrccId).toBeUndefined();
    });

    it('saveManagerData não apaga nem duplica os gerados; regrava só os manuais', async () => {
        const [deb] = (await q.fetchAllManagersFromDB()).filter((m) => m.id === 'grcc-debora');
        deb.pipeline.q3.projects[0] = { ...deb.pipeline.q3.projects[0], value: 999999 }; // tentativa de editar gerado
        deb.pipeline.q1.projects[0] = { ...deb.pipeline.q1.projects[0], value: 7 };
        await saveManagerData(deb);

        const gerados = await db.select().from(s.projects).where(isNotNull(s.projects.leadGrccId));
        expect(gerados).toHaveLength(1);
        expect(gerados[0].value).toBe(10);
        const manuais = await db.select().from(s.projects).where(isNull(s.projects.leadGrccId));
        expect(manuais.map((p) => p.value)).toEqual([7]);
    });

    it('cloneManager copia gerados como manuais (sem leadGrccId)', async () => {
        const { newId } = await cloneManager('grcc-debora', 'Clone');
        const doClone = await db.select().from(s.projects).where(eq(s.projects.managerId, newId));
        expect(doClone).toHaveLength(2);
        expect(doClone.every((p) => p.leadGrccId === null)).toBe(true);
    });
});
