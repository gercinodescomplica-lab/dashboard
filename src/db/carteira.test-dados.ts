// src/db/carteira.test-dados.ts
// Cenário comum dos testes da carteira (espelha produção de 06/11/2026, reduzido).
import type { db as Db } from '@/db/index';
import * as s from '@/db/schema';

export const AGORA = '2026-11-06T12:00:00.000Z';

export async function limpar(db: typeof Db) {
    for (const t of [s.movimentoCarteira, s.carteiraCliente, s.contrato, s.proposta, s.cx, s.projects, s.leadGrcc, s.cliente, s.managers]) await db.delete(t);
}

export async function cenario(db: typeof Db) {
    await limpar(db);
    const base = { avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 };
    await db.insert(s.managers).values([
        { ...base, id: 'grc1-bruno', name: 'Bruno Ítalo', role: 'GRC1', year: 2026 },
        { ...base, id: 'grc3-barone', name: 'Barone', role: 'GRC3', year: 2026 },
        { ...base, id: 'grc4-velha', name: 'Antiga', role: 'GRC4', year: 2025 },
        { ...base, id: 'grc4-beatriz', name: 'Beatriz', role: 'GRC4', year: 2026 },
        { ...base, id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026 },
        { ...base, id: 'kam1-malde', name: 'Malde', role: 'KAM1', year: 2026 },
        { ...base, id: 'kam3-gercino-teste', name: 'Gercino (teste)', role: 'KAM10', year: 2026, showInDashboard: false },
    ]);
    await db.insert(s.cliente).values([
        { id: 'c-smt', nome: 'Secretaria Municipal de Transportes', sigla: 'SMT', createdAt: AGORA },
        { id: 'c-sme', nome: 'Secretaria Municipal da Educação', sigla: 'SME', createdAt: AGORA },
        { id: 'c-smc', nome: 'Secretaria Municipal de Cultura', sigla: 'SMC', createdAt: AGORA },
        { id: 'c-oculto', nome: 'Órgão Oculto', sigla: 'OCU', ativo: false, createdAt: AGORA },
    ]);
    await db.insert(s.carteiraCliente).values([
        { clienteId: 'c-smt', gerencia: 'GRC3', movidoEm: AGORA },
        { clienteId: 'c-sme', gerencia: 'KAM1', movidoEm: AGORA },
        { clienteId: 'c-oculto', gerencia: 'GRC3', movidoEm: AGORA },
    ]);
    await db.insert(s.contrato).values([
        { id: 'ct-smt', numeroContrato: '1/2025', cliente: 'SMT', clienteId: 'c-smt', gerencia: 'GRC-3', nomeGerente: 'Barone', managerId: 'grc3-barone' },
    ]);
    await db.insert(s.proposta).values([
        { id: 'pr-smt', numeroProposta: 'P1', nomeOportunidade: 'Op', cliente: 'SMT', clienteId: 'c-smt', gerencia: 'GRC-3', managerId: 'grc3-barone' },
    ]);
    await db.insert(s.cx).values([
        { managerId: 'grc3-barone', cliente: 'SMT', clienteId: 'c-smt', problema: 'p', solucaoProposta: 's', externalId: 'planner-1' },
    ]);
    await db.insert(s.leadGrcc).values({ id: 1, cliente: 'SMT', criadoEm: AGORA, atualizadoEm: AGORA }); // FK de projects.lead_grcc_id
    await db.insert(s.projects).values([
        { managerId: 'grc3-barone', quarter: 'q1', orgao: 'SMT', clienteId: 'c-smt', name: 'Projeto SMT', value: 100 },
        { managerId: 'grcc-debora', quarter: 'q2', orgao: 'SMT', clienteId: 'c-smt', name: 'Lead SMT', value: 50, leadGrccId: 1 },
    ]);
}
