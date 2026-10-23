import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO, type LeadGrccDados } from '@/lib/grcc/tipos';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const q = await import('@/db/queries');
const s = await import('@/db/schema');
const { eq, isNull } = await import('drizzle-orm');

const lead = (over: Partial<LeadGrccDados> = {}): LeadGrccDados => ({
    ...LEAD_VAZIO,
    cliente: 'Prefeitura de Indaiatuba',
    solicitacao: 'Consultoria',
    categoria: 'No cliente',
    valor: 260758.68,
    uf: 'SP',
    municipio: 'Indaiatuba',
    previsaoFechamento: '2026-11-10',
    ...over,
});

beforeAll(async () => {
    await applyMigrations();
});

beforeEach(async () => {
    await db.delete(s.projects);
    await db.delete(s.leadGrccHistorico);
    await db.delete(s.leadGrcc);
    await db.delete(s.managers);
    await db.$client.execute("update system_settings set value = '0' where key = 'grcc_versao'");
    await db.$client.execute("delete from system_settings where key = 'grcc_ultimo_import'");
    await db.$client.execute("delete from dropdown_options where field like 'grcc_%' and field <> 'grcc_categoria'");
    const base = { avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 };
    await db.insert(s.managers).values([
        { ...base, id: 'grcc-velha', name: 'Débora', role: 'GRCC', year: 2025 },
        { ...base, id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026 },
        { ...base, id: 'grc1-x', name: 'X', role: 'GRC1', year: 2026 },
    ]);
});

describe('salvarLeadGrcc', () => {
    it('cadastro: grava lead, evento "cadastro", projeto da Débora (maior ano) e versão +1', async () => {
        const { lead: l, mudou } = await q.salvarLeadGrcc(null, lead());
        expect(mudou).toBe(true);
        expect(l.id).toBeGreaterThan(0);

        const hist = await q.fetchHistoricoLead(l.id);
        expect(hist).toHaveLength(1);
        expect(hist[0]).toMatchObject({ origem: 'cadastro', autor: 'GRCC', arquivo: null });
        expect(hist[0].mudancas).toContainEqual({ campo: 'valor', de: null, para: 260758.68 });

        const [proj] = await db.select().from(s.projects).where(eq(s.projects.leadGrccId, l.id));
        expect(proj).toMatchObject({ managerId: 'grcc-debora', quarter: 'q4', temperature: 'quente', value: 260758.68, orgao: 'Prefeitura de Indaiatuba' });

        expect(await q.lerVersaoGrcc()).toBe(1);
    });

    it('edição: um evento com as mudanças e projeto atualizado; sem mudança não gera evento nem versão', async () => {
        const { lead: l } = await q.salvarLeadGrcc(null, lead());
        const r = await q.salvarLeadGrcc(l.id, lead({ categoria: 'Perda', motivoPerda: 'Prazo', valor: 300000 }));
        expect(r.mudou).toBe(true);
        const hist = await q.fetchHistoricoLead(l.id);
        expect(hist[0].origem).toBe('edicao');
        expect(hist[0].mudancas.map((m) => m.campo)).toEqual(['categoria', 'motivoPerda', 'valor']);
        const [proj] = await db.select().from(s.projects).where(eq(s.projects.leadGrccId, l.id));
        expect(proj).toMatchObject({ temperature: 'perdido', value: 300000 });
        expect(await q.lerVersaoGrcc()).toBe(2);

        const igual = await q.salvarLeadGrcc(l.id, lead({ categoria: 'Perda', motivoPerda: 'Prazo', valor: 300000 }));
        expect(igual.mudou).toBe(false);
        expect(await q.fetchHistoricoLead(l.id)).toHaveLength(2);
        expect(await q.lerVersaoGrcc()).toBe(2);
    });

    it('sem gerente GRCC → ErroGrcc e nada gravado', async () => {
        await db.delete(s.managers);
        await expect(q.salvarLeadGrcc(null, lead())).rejects.toThrow('Gerente da GRCC não encontrado');
        expect(await db.select().from(s.leadGrcc)).toEqual([]);
        expect(await q.lerVersaoGrcc()).toBe(0);
    });

    it('acrescenta à lista valores novos de etapa/situação/motivo/família', async () => {
        await q.salvarLeadGrcc(null, lead({ etapa: 'Proposta no cliente', familiaDemanda: 'Consultoria' }));
        const listas = await q.fetchListasGrcc();
        expect(listas.etapa).toEqual(['Proposta no cliente']);
        expect(listas.familiaDemanda).toEqual(['Consultoria']);
        expect(listas.categoria).toHaveLength(7);
    });
});

describe('excluirLeadGrcc', () => {
    it('soft delete + evento "exclusao" + projeto apagado + some da lista', async () => {
        const { lead: l } = await q.salvarLeadGrcc(null, lead());
        await q.excluirLeadGrcc(l.id);
        expect(await q.listLeadsGrcc()).toEqual([]);
        expect((await q.fetchHistoricoLead(l.id))[0]).toMatchObject({ origem: 'exclusao', mudancas: [] });
        expect(await db.select().from(s.projects).where(eq(s.projects.leadGrccId, l.id))).toEqual([]);
        const [row] = await db.select().from(s.leadGrcc).where(eq(s.leadGrcc.id, l.id));
        expect(row.excluidoEm).not.toBeNull();
    });
});

describe('aplicarImportGrcc', () => {
    it('reclassifica no servidor, grava novos e alterados, mantém ausentes e registra o arquivo', async () => {
        const { lead: existente } = await q.salvarLeadGrcc(null, lead());
        const { lead: ausente } = await q.salvarLeadGrcc(null, lead({ cliente: 'ALESP', solicitacao: 'Chatbot', uf: 'SP', municipio: 'São Paulo' }));

        const r = await q.aplicarImportGrcc({
            arquivo: 'leads-out.xlsx',
            linhas: [
                { linha: 2, dados: lead({ valor: 999 }) },
                { linha: 3, dados: lead({ cliente: 'Câmara de Osasco', solicitacao: 'Nuvem', municipio: 'Osasco' }) },
            ],
            problemas: [],
            substituirPipelineManual: false,
        });
        expect(r).toEqual({ novos: 1, alterados: 1 });

        expect((await q.fetchHistoricoLead(existente.id))[0]).toMatchObject({ origem: 'importacao', arquivo: 'leads-out.xlsx' });
        expect(await q.getLeadGrcc(ausente.id)).not.toBeNull();
        expect((await q.listLeadsGrcc()).map((l) => l.cliente).sort()).toEqual(['ALESP', 'Câmara de Osasco', 'Prefeitura de Indaiatuba']);
        expect(await q.lerUltimoImportGrcc()).toMatchObject({ arquivo: 'leads-out.xlsx', novos: 1, alterados: 1 });
        expect(await q.lerVersaoGrcc()).toBe(3);
    });

    it('primeira importação exige confirmar a troca do pipeline manual', async () => {
        await db.insert(s.projects).values({ managerId: 'grcc-debora', quarter: 'q3', name: 'Nuvem', value: 1, temperature: 'quente' });
        expect(await q.fetchProjetosManuaisGrcc()).toHaveLength(1);
        await expect(
            q.aplicarImportGrcc({ arquivo: 'a.xlsx', linhas: [{ linha: 2, dados: lead() }], problemas: [], substituirPipelineManual: false })
        ).rejects.toThrow('Confirme a substituição do pipeline manual');
        expect(await db.select().from(s.leadGrcc)).toEqual([]);
    });

    it('com confirmação apaga só os projetos manuais da Débora', async () => {
        await db.insert(s.projects).values([
            { managerId: 'grcc-debora', quarter: 'q3', name: 'Nuvem', value: 1, temperature: 'quente' },
            { managerId: 'grc1-x', quarter: 'q3', name: 'Outro gerente', value: 1, temperature: 'quente' },
        ]);
        await q.aplicarImportGrcc({ arquivo: 'a.xlsx', linhas: [{ linha: 2, dados: lead() }], problemas: [], substituirPipelineManual: true });
        const deb = await db.select().from(s.projects).where(eq(s.projects.managerId, 'grcc-debora'));
        expect(deb).toHaveLength(1);
        expect(deb[0].leadGrccId).not.toBeNull();
        expect(await db.select().from(s.projects).where(eq(s.projects.managerId, 'grc1-x'))).toHaveLength(1);
        expect(await db.select().from(s.projects).where(isNull(s.projects.leadGrccId))).toHaveLength(1);
    });
});

describe('fetchMovimentacoesRecentes', () => {
    it('últimos eventos com cliente, mais recente primeiro', async () => {
        const { lead: l } = await q.salvarLeadGrcc(null, lead());
        await q.salvarLeadGrcc(l.id, lead({ valor: 1 }));
        const mov = await q.fetchMovimentacoesRecentes(15);
        expect(mov.map((m) => m.origem)).toEqual(['edicao', 'cadastro']);
        expect(mov[0].cliente).toBe('Prefeitura de Indaiatuba');
    });
});
