import { describe, it, expect, beforeAll, vi } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import { managers, cx, visits, projects, contrato, churn } from '@/db/schema';

vi.mock('@/app/settings/orgChartActions', () => ({ fetchOrgChart: vi.fn() }));

import { runAiTool, diasAte, norm } from './tools';

function emDias(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

beforeAll(async () => {
    await applyMigrations();
    await db.insert(managers).values({
        id: 'm-ana', name: 'Ana Analise', role: 'GRC-3', avatarUrl: '', year: 2026,
        meta: 2_000_000, contratado: 0, forecastFinal: 0, showInDashboard: true,
    });
    await db.insert(contrato).values([
        { id: 'c1', numeroContrato: 'CT-001', cliente: 'Secretaria da Saúde', vlContratado: 500_000, vlSaldo: 50_000, situacao: 'Vigente', dtFimVigencia: emDias(20), managerId: 'm-ana' },
        { id: 'c2', numeroContrato: 'CT-002', cliente: 'SPTrans', vlContratado: 300_000, situacao: 'Vigente', dtFimVigencia: emDias(400), managerId: 'm-ana' },
        { id: 'c3', numeroContrato: 'CT-003', cliente: 'Secretaria da Saúde', vlContratado: 100_000, situacao: 'Encerrado', dtFimVigencia: emDias(-30), managerId: 'm-ana' },
    ]);
    await db.insert(projects).values([
        { managerId: 'm-ana', quarter: 'q4', orgao: 'Saúde', name: 'Prontuário', value: 800_000, temperature: 'quente', description: 'expansão' },
        { managerId: 'm-ana', quarter: 'q2', orgao: 'SPTrans', name: 'Bilhetagem', value: 200_000, temperature: 'frio' },
    ]);
    await db.insert(cx).values({
        managerId: 'm-ana', cliente: 'SAUDE', titulo: 'Atraso no faturamento', problema: 'nota travada', solucaoProposta: '',
        tipo: 'bloqueio', status: 'pendente', criticidade: 'alta',
    });
    await db.insert(visits).values({ managerId: 'm-ana', titulo: 'Reunião Saúde', local: 'Sede', motivo: 'renovação', data: '2026-10-01' });
    await db.insert(churn).values({ managerId: 'm-ana', numeroContrato: 'CT-003', valor: 100_000, descricao: 'não renovado', motivo: 'orçamento' });
});

describe('ferramentas de análise da IA', () => {
    it('norm ignora acento e caixa; diasAte conta dias', () => {
        expect(norm('  Saúde ')).toBe('saude');
        expect(diasAte('2026-01-11', '2026-01-01')).toBe(10);
        expect(diasAte('lixo')).toBeNull();
    });

    it('analisar_cliente cruza contratos, pipeline, CX, visitas e churn sem depender de acento', async () => {
        const r = await runAiTool('analisar_cliente', { cliente: 'saude' }) as {
            encontrado: boolean;
            resumo: Record<string, unknown> & { proximoVencimento: { numero: string } | null };
        };
        expect(r.encontrado).toBe(true);
        expect(r.resumo).toMatchObject({
            contratos: 2, contratosVigentes: 1, valorVigente: 500_000, saldoVigente: 50_000,
            oportunidadesAbertas: 1, valorPipelineAberto: 800_000,
            bloqueiosAbertos: 1, visitas: 1, churn: 1, valorChurn: 100_000,
        });
        expect(r.resumo.proximoVencimento?.numero).toBe('CT-001');
    });

    it('analisar_cliente avisa quando nada casa', async () => {
        const r = await runAiTool('analisar_cliente', { cliente: 'zzz-inexistente' }) as { encontrado: boolean };
        expect(r.encontrado).toBe(false);
    });

    it('contratos_vencendo pega só vigentes dentro da janela, aceitando nome do gerente', async () => {
        const r = await runAiTool('contratos_vencendo', { dias: 90, managerId: 'Ana' }) as {
            vencendo: { total: number; contratos: { numero: string }[] };
        };
        expect(r.vencendo.total).toBe(1);
        expect(r.vencendo.contratos[0].numero).toBe('CT-001');
    });

    it('analytics_contratos traz vencimentos e concentração por cliente', async () => {
        const r = await runAiTool('analytics_contratos', {}) as {
            vigentes: { vencendoEm30Dias: { quantidade: number }; top10Clientes: { nome: string }[] };
        };
        expect(r.vigentes.vencendoEm30Dias.quantidade).toBe(1);
        expect(r.vigentes.top10Clientes[0].nome).toBe('Secretaria da Saúde');
    });

    it('buscar_oportunidades filtra por temperatura e soma por temperatura', async () => {
        const r = await runAiTool('buscar_oportunidades', { temperatura: 'quente' }) as {
            total: number; valorTotal: number; oportunidades: { nome: string; descricao: string }[];
        };
        expect(r).toMatchObject({ total: 1, valorTotal: 800_000 });
        expect(r.oportunidades[0]).toMatchObject({ nome: 'Prontuário', descricao: 'expansão' });
    });

    it('listar_churn soma o valor perdido', async () => {
        const r = await runAiTool('listar_churn', {}) as { total: number; valorPerdido: number };
        expect(r).toMatchObject({ total: 1, valorPerdido: 100_000 });
    });
});
