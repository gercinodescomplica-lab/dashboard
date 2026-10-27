import { describe, it, expect } from 'vitest';
import { agruparPorCidade, alternarOrdem, correcoesDeAndamento, eventosComerciais, linhaDoTempoAndamento, ordemValida, ordenarLeads, proximoPendente } from './organizar';
import { LEAD_VAZIO, type EventoHistorico, type LeadGrcc } from './tipos';

const ev = (id: number, quando: string, mudancas: EventoHistorico['mudancas'], origem: EventoHistorico['origem'] = 'edicao'): EventoHistorico => ({
    id, leadId: 1, quando, origem, arquivo: null, autor: 'GRCC', mudancas,
});

describe('linhaDoTempoAndamento', () => {
    it('lista cada andamento gravado, mais recente primeiro, ignorando outras mudanças', () => {
        const eventos = [
            ev(1, '2026-08-01T10:00:00Z', [{ campo: 'status', de: null, para: 'Proposta no cliente' }, { campo: 'valor', de: null, para: 10 }], 'importacao'),
            ev(2, '2026-09-01T10:00:00Z', [{ campo: 'valor', de: 10, para: 20 }]),
            ev(3, '2026-10-01T10:00:00Z', [{ campo: 'status', de: 'Proposta no cliente', para: 'Reunião em 02/10' }]),
        ];
        expect(linhaDoTempoAndamento(eventos)).toEqual([
            { id: 3, quando: '2026-10-01T10:00:00Z', autor: 'GRCC', texto: 'Reunião em 02/10' },
            { id: 1, quando: '2026-08-01T10:00:00Z', autor: 'GRCC', texto: 'Proposta no cliente' },
        ]);
    });

    it('andamento apagado (para vazio) não vira registro', () => {
        expect(linhaDoTempoAndamento([ev(1, '2026-08-01T10:00:00Z', [{ campo: 'status', de: 'x', para: null }])])).toEqual([]);
    });
});

const lead = (id: number, over: Partial<LeadGrcc>): LeadGrcc => ({
    ...LEAD_VAZIO, visivelDashboard: true, id, cliente: `C${id}`, criadoEm: 'x', atualizadoEm: 'x', ...over,
});

describe('agruparPorCidade', () => {
    const leads = [
        lead(1, { uf: 'SP', municipio: 'Valinhos', valor: 100, categoria: 'No cliente' }),
        lead(2, { uf: 'MG', municipio: 'Contagem', valor: 50 }),
        lead(3, { uf: 'SP', municipio: 'Valinhos', valor: 30, categoria: 'Perda' }),
        lead(4, { uf: 'SP', municipio: null }),
        lead(5, { uf: 'SP', municipio: 'Campinas' }),
    ];

    it('"Sem cidade" vem primeiro; depois UF e município em ordem alfabética', () => {
        expect(agruparPorCidade(leads).map((g) => g.rotulo)).toEqual(['Sem cidade', 'Contagem · MG', 'Campinas · SP', 'Valinhos · SP']);
    });

    it('soma o valor ativo (sem Perda) e conta por categoria', () => {
        const valinhos = agruparPorCidade(leads).find((g) => g.rotulo === 'Valinhos · SP')!;
        expect(valinhos.leads.map((l) => l.id)).toEqual([1, 3]);
        expect(valinhos.valorAtivo).toBe(100);
        expect(valinhos.porCategoria).toEqual({ 'No cliente': 1, Perda: 1 });
    });

    it('sem leads sem cidade, não cria o grupo', () => {
        expect(agruparPorCidade([leads[0]]).map((g) => g.rotulo)).toEqual(['Valinhos · SP']);
    });
});

describe('proximoPendente', () => {
    const leads = [
        lead(1, { uf: 'SP', municipio: 'Valinhos', valor: 1, previsaoFechamento: '2026-11-01' }),
        lead(2, { uf: 'SP', municipio: null }),
        lead(3, { uf: 'SP', municipio: null }),
    ];

    it('devolve o primeiro lead com pendência que ainda não foi visto', () => {
        expect(proximoPendente(leads, new Set())).toBe(2);
        expect(proximoPendente(leads, new Set([2]))).toBe(3);
    });

    it('acabou a fila → null', () => {
        expect(proximoPendente(leads, new Set([2, 3]))).toBeNull();
    });
});

describe('eventosComerciais', () => {
    it('mantém só campos comerciais e nunca expõe autor, arquivo ou origem', () => {
        const r = eventosComerciais([
            { ...ev(1, '2026-08-01T10:00:00Z', [{ campo: 'cliente', de: null, para: 'X' }, { campo: 'categoria', de: null, para: 'Novo' }], 'importacao'), arquivo: 'leads.xlsx' },
            ev(2, '2026-09-01T10:00:00Z', [{ campo: 'contatoEmail', de: 'a@b', para: 'c@d' }, { campo: 'categoria', de: 'Novo', para: 'No cliente' }]),
            ev(3, '2026-09-02T10:00:00Z', [{ campo: 'contatoTelefone', de: '1', para: '2' }]),
            ev(4, '2026-09-03T10:00:00Z', [{ campo: 'categoria', de: 'No cliente', para: 'Perda' }], 'exclusao'),
        ]);
        expect(r).toEqual([
            { id: 2, quando: '2026-09-01T10:00:00Z', inicio: false, mudancas: [{ campo: 'categoria', de: 'Novo', para: 'No cliente' }] },
            { id: 1, quando: '2026-08-01T10:00:00Z', inicio: true, mudancas: [] },
        ]);
        for (const e of r) expect(Object.keys(e).sort()).toEqual(['id', 'inicio', 'mudancas', 'quando']);
    });
});

it('eventosComerciais: só a primeira entrada vira "entrou no cadastro"', () => {
    const r = eventosComerciais([
        ev(1, '2026-10-26T14:12:00Z', [{ campo: 'cliente', de: null, para: 'X' }], 'importacao'),
        ev(2, '2026-10-26T14:16:00Z', [{ campo: 'cliente', de: null, para: 'X' }, { campo: 'etapa', de: null, para: 'Validação interna' }], 'importacao'),
    ]);
    expect(r.map((e) => [e.id, e.inicio])).toEqual([[2, false], [1, true]]);
    expect(r[0].mudancas).toEqual([{ campo: 'etapa', de: null, para: 'Validação interna' }]);
});

describe('ordenarLeads', () => {
    const ls = [
        lead(1, { cliente: 'Prefeitura de Bauru', valor: 0, categoria: 'No cliente', previsaoFechamento: '2026-12-01', atualizadoEm: '2026-10-02' }),
        lead(2, { cliente: 'Câmara de Araras', valor: 500, categoria: 'Novo', previsaoFechamento: null, atualizadoEm: '2026-10-05' }),
        lead(3, { cliente: 'prefeitura de Atibaia', valor: 100, categoria: 'Perda', previsaoFechamento: '2026-11-01', atualizadoEm: '2026-10-01' }),
    ];
    const ids = (o: Parameters<typeof ordenarLeads>[1]) => ordenarLeads(ls, o).map((l) => l.id);

    it('texto ignora acento e caixa', () => {
        expect(ids({ coluna: 'cliente', direcao: 'asc' })).toEqual([2, 3, 1]);
        expect(ids({ coluna: 'cliente', direcao: 'desc' })).toEqual([1, 3, 2]);
    });

    it('vazios ficam no fim nas duas direções', () => {
        expect(ids({ coluna: 'valor', direcao: 'desc' })).toEqual([2, 3, 1]);
        expect(ids({ coluna: 'valor', direcao: 'asc' })).toEqual([3, 2, 1]);
        expect(ids({ coluna: 'previsao', direcao: 'asc' })).toEqual([3, 1, 2]);
        expect(ids({ coluna: 'previsao', direcao: 'desc' })).toEqual([1, 3, 2]);
    });

    it('categoria segue a ordem do funil, não a alfabética', () => {
        expect(ids({ coluna: 'categoria', direcao: 'asc' })).toEqual([2, 1, 3]);
    });

    it('não muta a lista original', () => {
        ordenarLeads(ls, { coluna: 'cliente', direcao: 'asc' });
        expect(ls.map((l) => l.id)).toEqual([1, 2, 3]);
    });
});

describe('alternarOrdem / ordemValida', () => {
    it('mesma coluna inverte; coluna nova começa na direção natural', () => {
        expect(alternarOrdem({ coluna: 'valor', direcao: 'desc' }, 'valor')).toEqual({ coluna: 'valor', direcao: 'asc' });
        expect(alternarOrdem({ coluna: 'valor', direcao: 'desc' }, 'previsao')).toEqual({ coluna: 'previsao', direcao: 'asc' });
        expect(alternarOrdem({ coluna: 'cliente', direcao: 'asc' }, 'atualizado')).toEqual({ coluna: 'atualizado', direcao: 'desc' });
    });

    it('recusa valor salvo inválido', () => {
        expect(ordemValida({ coluna: 'valor', direcao: 'asc' })).toBe(true);
        expect(ordemValida({ coluna: 'x', direcao: 'asc' })).toBe(false);
        expect(ordemValida(null)).toBe(false);
    });
});

describe('correção de andamento', () => {
    const ajuste = (id: number, quando: string, corrige: number, para: string | null, origem: 'correcao' | 'remocao' = 'correcao'): EventoHistorico => ({
        ...ev(id, quando, [{ campo: 'status', de: 'x', para }], origem),
        corrige,
    });
    const base = [
        ev(1, '2026-08-01T10:00:00Z', [{ campo: 'status', de: null, para: 'Propsta enviada' }], 'importacao'),
        ev(2, '2026-09-01T10:00:00Z', [{ campo: 'status', de: 'Propsta enviada', para: 'Reunião 02/09' }]),
    ];

    it('aplica a última correção e marca editado', () => {
        const r = linhaDoTempoAndamento([...base, ajuste(3, '2026-10-01T10:00:00Z', 1, 'Proposta errada'), ajuste(4, '2026-10-02T10:00:00Z', 1, 'Proposta enviada')]);
        expect(r).toEqual([
            { id: 2, quando: '2026-09-01T10:00:00Z', autor: 'GRCC', texto: 'Reunião 02/09' },
            { id: 1, quando: '2026-08-01T10:00:00Z', autor: 'GRCC', texto: 'Proposta enviada', editadoEm: '2026-10-02T10:00:00Z' },
        ]);
    });

    it('andamento removido some da linha do tempo e do recorte comercial', () => {
        const eventos = [...base, ajuste(3, '2026-10-01T10:00:00Z', 2, null, 'remocao')];
        expect(linhaDoTempoAndamento(eventos).map((a) => a.id)).toEqual([1]);
        expect(eventosComerciais(eventos).some((e) => e.mudancas.some((m) => m.campo === 'status'))).toBe(false);
        expect(correcoesDeAndamento(eventos).get(2)).toBeNull();
    });

    it('recorte comercial mostra o texto corrigido e nunca o evento de ajuste', () => {
        const r = eventosComerciais([...base, ajuste(3, '2026-10-01T10:00:00Z', 2, 'Reunião 03/09')]);
        expect(r.map((e) => e.id)).toEqual([2, 1]);
        expect(r[0].mudancas).toEqual([{ campo: 'status', de: 'Propsta enviada', para: 'Reunião 03/09' }]);
    });
});
