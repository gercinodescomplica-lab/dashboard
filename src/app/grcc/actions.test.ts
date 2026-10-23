import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO } from '@/lib/grcc/tipos';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_noStore: vi.fn() }));
process.env.GRCC_KEY = 'chave-certa';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const a = await import('./actions');
const svc = await import('@/services/grcc.service');

const dados = { ...LEAD_VAZIO, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', uf: 'SP', municipio: 'Indaiatuba', valor: 10, previsaoFechamento: '2026-11-01' };

beforeAll(async () => {
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026, avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 });
});

describe('actions /grcc', () => {
    it('verificarChaveGrcc', async () => {
        expect(await a.verificarChaveGrcc('chave-certa')).toBe(true);
        expect(await a.verificarChaveGrcc(' chave-certa ')).toBe(true);
        expect(await a.verificarChaveGrcc('errada')).toBe(false);
        expect(await a.verificarChaveGrcc('')).toBe(false);
    });

    it('sem GRCC_KEY configurada nada passa', async () => {
        const antes = process.env.GRCC_KEY;
        delete process.env.GRCC_KEY;
        expect(await a.verificarChaveGrcc('')).toBe(false);
        expect(await a.verificarChaveGrcc('qualquer')).toBe(false);
        process.env.GRCC_KEY = antes;
    });

    it('GRCC_KEY com espaço/quebra de linha no fim (colada no painel) ainda aceita a chave aparada', async () => {
        const antes = process.env.GRCC_KEY;
        try {
            process.env.GRCC_KEY = 'chave-certa\n';
            expect(await a.verificarChaveGrcc('chave-certa')).toBe(true);
            process.env.GRCC_KEY = '  \n';
            expect(await a.verificarChaveGrcc('')).toBe(false);
            expect(await a.verificarChaveGrcc('  ')).toBe(false);
        } finally {
            process.env.GRCC_KEY = antes;
        }
    });

    it('recusa escrita com chave inválida e não grava', async () => {
        expect(await a.salvarLead('errada', null, dados)).toEqual({ ok: false, erro: 'Chave GRCC inválida.' });
        expect(await a.excluirLead('errada', 1)).toEqual({ ok: false, erro: 'Chave GRCC inválida.' });
        expect(await a.confirmarImportacao('errada', { arquivo: 'a.xlsx', linhas: [], problemas: [], substituirPipelineManual: false }))
            .toEqual({ ok: false, erro: 'Chave GRCC inválida.' });
        expect(await db.select().from(s.leadGrcc)).toEqual([]);
    });

    it('salvarLead valida (exige local na tela) e devolve erros por campo', async () => {
        const r = await a.salvarLead('chave-certa', null, { ...dados, municipio: null });
        expect(r).toEqual({ ok: false, erro: 'Corrija os campos destacados.', erros: { municipio: 'Informe o município.' } });
    });

    it('salvar → excluir, e o painel/histórico refletem', async () => {
        const r = await a.salvarLead('chave-certa', null, dados);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const painel = await svc.carregarPainelGrcc();
        expect(painel.leads).toHaveLength(1);
        expect(painel.versao).toBe(1);
        expect(await svc.versaoGrcc()).toBe(1);

        expect(await a.excluirLead('chave-certa', r.valor.id)).toEqual({ ok: true, valor: null });
        expect((await svc.historicoDoLead(r.valor.id)).map((e) => e.origem)).toEqual(['exclusao', 'cadastro']);
    });

    it('confirmarImportacao valida cada linha no servidor (payload adulterado vira problema, não grava)', async () => {
        const queries = await import('@/db/queries');
        const espiao = vi.spyOn(queries, 'aplicarImportGrcc');
        const r = await a.confirmarImportacao('chave-certa', {
            arquivo: 'a.xlsx',
            linhas: [{ linha: 2, dados: { ...dados, cliente: 'Outro', valor: -5 } }],
            problemas: [],
            substituirPipelineManual: false,
        });
        expect(r).toMatchObject({ ok: true, valor: { novos: 0, alterados: 0 } });
        if (r.ok) expect(r.valor.problemas).toEqual([expect.objectContaining({ linha: 2, cliente: 'Outro' })]);
        expect((await svc.carregarPainelGrcc()).leads.find((l) => l.cliente === 'Outro')).toBeUndefined();
        const enviado = espiao.mock.calls[0][0];
        expect(enviado.linhas).toEqual([]);
        expect(enviado.problemas).toHaveLength(1);
        expect(enviado.problemas[0]).toMatchObject({ linha: 2, cliente: 'Outro' });
        expect(enviado.problemas[0].motivo).not.toBe('');
        espiao.mockRestore();
    });

    it('payload malformado devolve falha em vez de lançar', async () => {
        const base = { arquivo: 'a.xlsx', problemas: [], substituirPipelineManual: false };
        for (const linhas of [null, 'x']) {
            expect(await a.confirmarImportacao('chave-certa', { ...base, linhas } as never)).toMatchObject({ ok: false });
        }
        expect(await a.confirmarImportacao('chave-certa', { ...base, linhas: [], problemas: null } as never)).toMatchObject({ ok: false });
        for (const linhas of [[null], [{ linha: 2 }]]) {
            const r = await a.confirmarImportacao('chave-certa', { ...base, linhas } as never);
            expect(r).toMatchObject({ ok: true, valor: { novos: 0, alterados: 0 } });
        }
    });

    it('confirmarImportacao usa a regra de importação: Contratado sem início, Perda sem motivo e e-mail "n/a" entram', async () => {
        const r = await a.confirmarImportacao('chave-certa', {
            arquivo: 'b.xlsx',
            linhas: [
                { linha: 2, dados: { ...dados, cliente: 'Prefeitura de Santos', municipio: 'Santos', categoria: 'Contratado' } },
                { linha: 3, dados: { ...dados, cliente: 'Prefeitura de Campinas', municipio: 'Campinas', categoria: 'Perda' } },
                { linha: 4, dados: { ...dados, cliente: 'Prefeitura de Sorocaba', municipio: 'Sorocaba', contatoEmail: 'n/a' } },
                { linha: 5, dados: { ...dados, cliente: 'Prefeitura de Jundiaí', municipio: 'Jundiaí', duracaoMeses: 999 } },
            ],
            problemas: [{ linha: 9, cliente: 'Do navegador', motivo: 'Cliente vazio' }],
            substituirPipelineManual: false,
        });
        expect(r).toMatchObject({ ok: true, valor: { novos: 3, alterados: 0 } });
        if (!r.ok) return;
        // Só as linhas que o SERVIDOR recusou (as do navegador o diálogo já mostrou).
        expect(r.valor.problemas).toEqual([expect.objectContaining({ linha: 5, cliente: 'Prefeitura de Jundiaí' })]);
        const leads = (await svc.carregarPainelGrcc()).leads;
        expect(leads.find((l) => l.cliente === 'Prefeitura de Sorocaba')?.contatoEmail).toBeNull();
        expect(leads.find((l) => l.cliente === 'Prefeitura de Jundiaí')).toBeUndefined();
    });
});
