import { describe, it, expect, beforeAll, vi } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import { managers, cx, visits, storeProducts, projects } from '@/db/schema';

// consultar_organograma delega pra uma server action de outra feature — mocada
// aqui pra isolar o teste de tools.ts da autenticação/leitura de cookies dela.
vi.mock('@/app/settings/orgChartActions', () => ({
    fetchOrgChart: vi.fn().mockResolvedValue({
        director: { name: 'Diretora X' },
        subdirectors: [{ id: 'sd1', name: 'Subdiretor Y', subtitle: '', people: [{ name: 'Fulano' }] }],
        departments: [{
            id: 'd1', name: 'DRM', subtitle: '', color: 'indigo',
            sections: [{ id: 's1', name: 'Núcleo A', people: [{ name: 'Ciclana' }], leader: { name: 'Beltrano' } }],
        }],
        version: '1',
    }),
}));

import { AI_TOOLS, runAiTool } from './tools';

beforeAll(async () => {
    await applyMigrations();
    await db.insert(managers).values({
        id: 'm-ai', name: 'Gerente IA', role: 'GRC-1', avatarUrl: '', year: 2026,
        meta: 1_000_000, contratado: 400_000, forecastFinal: 900_000, showInDashboard: true,
    });
    await db.insert(managers).values({
        id: 'm-oculto', name: 'Gerente Oculto', role: 'GRC-9', avatarUrl: '', year: 2026,
        meta: 1, contratado: 0, forecastFinal: 0, showInDashboard: false,
    });
    // contratado de 120k em 12 meses, começando em julho = 6 meses em 2026 = 60k de novos negócios.
    await db.insert(projects).values({
        managerId: 'm-ai', quarter: 'q3', name: 'Projeto Fechado', value: 120_000,
        temperature: 'contratado', durationMonths: 12, billingStartMonth: 7,
    });
    await db.insert(cx).values([
        {
            managerId: 'm-ai', cliente: 'ACME', titulo: 'Bloqueio X', problema: 'p', solucaoProposta: '',
            tipo: 'bloqueio', status: 'analise', criticidade: 'alta', externalBlockerLabel: 'DIT',
            categoria: 'juridico',
        },
        {
            managerId: 'm-ai', cliente: 'ACME', titulo: 'Tarefa Y', problema: 'p', solucaoProposta: '',
            tipo: 'tarefa', status: 'pendente', criticidade: 'baixa',
        },
    ]);
    await db.insert(visits).values({
        managerId: 'm-ai', titulo: 'Visita SEFAZ', local: 'SP', motivo: 'kickoff', data: '2026-09-01',
    });
    await db.insert(storeProducts).values({
        name: 'Produto IA', directorate: 'DRM', status: 'Ativo', phase: 'Produção',
        marketplace: true, category: 'Dados', responsavel: 'Fulano',
    });
});

describe('AI tools', () => {
    it('AI_TOOLS tem os 14 schemas', () => {
        expect(AI_TOOLS.map((t) => t.function.name).sort()).toEqual([
            'analisar_cliente', 'analytics_contratos', 'buscar_contratos', 'buscar_oportunidades',
            'consultar_organograma', 'contratos_vencendo', 'detalhar_gerente',
            'listar_bloqueios_cx', 'listar_churn', 'listar_gerentes', 'listar_itens_cx', 'listar_produtos_store',
            'listar_propostas', 'listar_visitas',
        ]);
    });

    it('listar_gerentes usa a fórmula do dashboard (novos negócios ÷ meta) e esconde gerente oculto', async () => {
        const res = await runAiTool('listar_gerentes', {}) as {
            gerentes: Array<{ nome: string; atingimentoPct: number; novosNegocios: number }>;
            totaisDRM: { meta: number };
        };
        const g = res.gerentes.find((x) => x.nome === 'Gerente IA');
        expect(g).toMatchObject({ novosNegocios: 60_000, atingimentoPct: 6 });
        expect(res.gerentes.map((x) => x.nome)).not.toContain('Gerente Oculto');
        expect(res.totaisDRM.meta).toBe(1_000_000);
    });

    it('detalhar_gerente aceita o nome no lugar do id', async () => {
        const res = await runAiTool('detalhar_gerente', { managerId: 'gerente ia' }) as { id: string };
        expect(res.id).toBe('m-ai');
    });

    it('detalhar_gerente retorna pipeline por trimestre e erro pra id inexistente', async () => {
        const res = await runAiTool('detalhar_gerente', { managerId: 'm-ai' }) as {
            nome: string; pipelinePorTrimestre: Record<string, { total: number }>;
        };
        expect(res.nome).toBe('Gerente IA');
        expect(res.pipelinePorTrimestre).toHaveProperty('q1');

        const err = await runAiTool('detalhar_gerente', { managerId: 'nao-existe' }) as { error: string };
        expect(err.error).toMatch(/não encontrado/);
    });

    it('listar_bloqueios_cx com apenasExterno filtra', async () => {
        const res = await runAiTool('listar_bloqueios_cx', { apenasExterno: true }) as { total: number; bloqueios: { fatorExterno: string }[] };
        expect(res.total).toBe(1);
        expect(res.bloqueios[0].fatorExterno).toBe('DIT');
    });

    it('listar_visitas traz a visita seedada', async () => {
        const res = await runAiTool('listar_visitas', { managerId: 'm-ai' }) as { visitas: { titulo: string }[] };
        expect(res.visitas.map((v) => v.titulo)).toContain('Visita SEFAZ');
    });

    it('ferramenta desconhecida devolve { error } em vez de lançar', async () => {
        expect(await runAiTool('nao_existe', {})).toEqual({ error: expect.stringContaining('desconhecida') });
    });

    it('listar_itens_cx traz tarefa e bloqueio juntos, e filtra por tipo', async () => {
        const todos = await runAiTool('listar_itens_cx', { managerId: 'm-ai' }) as { total: number; itens: { titulo: string; tipo: string }[] };
        expect(todos.itens.map((i) => i.titulo).sort()).toEqual(['Bloqueio X', 'Tarefa Y']);

        const soTarefas = await runAiTool('listar_itens_cx', { tipo: 'tarefa' }) as { itens: { titulo: string }[] };
        expect(soTarefas.itens.map((i) => i.titulo)).toEqual(['Tarefa Y']);
    });

    it('listar_produtos_store filtra por categoria', async () => {
        const res = await runAiTool('listar_produtos_store', { category: 'dados' }) as { total: number; produtos: { nome: string }[] };
        expect(res.total).toBe(1);
        expect(res.produtos[0].nome).toBe('Produto IA');
    });

    it('buscar_contratos sem query devolve resumo agregado', async () => {
        const res = await runAiTool('buscar_contratos', {}) as { total: number; dica: string };
        expect(res.total).toBe(0);
        expect(res.dica).toMatch(/query/);
    });

    it('analytics_contratos e listar_propostas não lançam com a carteira vazia', async () => {
        const analytics = await runAiTool('analytics_contratos', {}) as { totalContratos: number };
        expect(analytics.totalContratos).toBe(0);

        const propostas = await runAiTool('listar_propostas', {}) as { total: number };
        expect(propostas.total).toBe(0);
    });

    it('consultar_organograma devolve diretor, subdiretores e departamentos', async () => {
        const res = await runAiTool('consultar_organograma', {}) as {
            diretor: { name: string };
            departamentos: { nome: string; secoes: { lider: string | null; pessoas: string[] }[] }[];
        };
        expect(res.diretor.name).toBe('Diretora X');
        expect(res.departamentos[0].secoes[0]).toMatchObject({ lider: 'Beltrano', pessoas: ['Ciclana'] });
    });
});
