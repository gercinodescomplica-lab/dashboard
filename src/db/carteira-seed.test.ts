// src/db/carteira-seed.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { semearCarteira } = await import('./carteira-seed');

beforeAll(applyMigrations);
beforeEach(async () => {
    for (const t of [s.movimentoCarteira, s.carteiraCliente, s.contrato, s.proposta, s.cx, s.projects, s.leadGrcc, s.cliente, s.managers]) await db.delete(t);
    const base = { avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0, year: 2026 };
    await db.insert(s.managers).values([
        { ...base, id: 'grc1-bruno', name: 'Bruno', role: 'GRC1', servedClients: JSON.stringify(['PGM (Procuradoria Geral do Município)', 'SEME (Secretaria Municipal de Esportes e Lazer)']) },
        { ...base, id: 'grc4-beatriz', name: 'Beatriz', role: 'GRC4', servedClients: JSON.stringify(['Ouvidoria Geral do Município']) },
        { ...base, id: 'kam3-andrea', name: 'Andrea', role: 'KAM3', servedClients: JSON.stringify(['SEGES (Secretaria de Gestão)']) },
        { ...base, id: 'kam3-gercino-teste', name: 'Teste', role: 'KAM10', showInDashboard: false, servedClients: JSON.stringify(['SEGES (Secretaria de Gestão)']) },
        { ...base, id: 'grcc-debora', name: 'Débora', role: 'GRCC', servedClients: JSON.stringify(['SES PE (Secretaria de Saúde de Pernambuco)']) },
    ]);
    await db.insert(s.contrato).values([
        { id: 'c1', numeroContrato: '1', cliente: 'PGM', managerId: 'grc1-bruno', gerencia: 'GRC-1' },
        { id: 'c2', numeroContrato: '2', cliente: 'SEME', managerId: 'grc4-beatriz', gerencia: 'GRC-4' },
        { id: 'c3', numeroContrato: '3', cliente: 'ALESP', managerId: 'grc4-beatriz', gerencia: 'GRC-4' },
    ]);
    await db.insert(s.proposta).values([{ id: 'p1', numeroProposta: 'P1', nomeOportunidade: 'X', cliente: 'Procuradoria Geral do Município - PGM', managerId: 'grc1-bruno' }]);
    await db.insert(s.leadGrcc).values({ id: 7, cliente: 'Prefeitura de Betim', criadoEm: '2026-11-06T12:00:00.000Z', atualizadoEm: '2026-11-06T12:00:00.000Z' });
    await db.insert(s.projects).values([
        { managerId: 'grcc-debora', quarter: 'q1', orgao: 'Prefeitura de Betim', name: 'Lead', value: 1, leadGrccId: 7 },
        { managerId: 'grc1-bruno', quarter: 'q1', orgao: 'Câmara de Osasco', name: 'Manual', value: 1 },
    ]);
});

describe('semearCarteira', () => {
    it('clientes e carteira do served_clients; duplicata fica no card visível', async () => {
        const r = await semearCarteira();
        expect(r.naCarteira).toBe(5);
        expect(r.duplicados).toEqual([{ sigla: 'SEGES', ficou: 'KAM3', perdeu: 'KAM10' }]);
        const ouv = (await db.select().from(s.cliente).where(eq(s.cliente.nome, 'Ouvidoria Geral do Município')))[0];
        expect(ouv.sigla).toBeNull();
    });
    it('liga as linhas, cria cliente sem carteira para o que não casou, ignora lead GRCC e não move nada', async () => {
        const r = await semearCarteira();
        const contratos = await db.select().from(s.contrato);
        expect(contratos.every((c) => c.clienteId)).toBe(true);
        expect(contratos.find((c) => c.id === 'c2')!.managerId).toBe('grc4-beatriz'); // não move
        expect((await db.select().from(s.proposta))[0].clienteId).toBe(contratos.find((c) => c.id === 'c1')!.clienteId);
        const projs = await db.select().from(s.projects);
        expect(projs.find((p) => p.name === 'Lead')!.clienteId).toBeNull();
        expect(projs.find((p) => p.name === 'Manual')!.clienteId).toBeTruthy();
        expect(r.criadosSemCarteira.sort()).toEqual(['ALESP', 'Câmara de Osasco']);
        expect(r.fora.map((f) => f.sigla)).toEqual(['SEME']);
        expect(r.ligados).toEqual({ contrato: 3, proposta: 1, cx: 0, projects: 1 });
    });
    it('idempotente', async () => {
        await semearCarteira();
        const segunda = await semearCarteira();
        expect(segunda.clientesCriados).toBe(0);
        expect(await db.select().from(s.cliente)).toHaveLength(7);
    });
});
