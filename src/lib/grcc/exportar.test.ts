import { describe, it, expect } from 'vitest';
import { nomeArquivoExportacao, planilhaDosLeads } from './exportar';
import { lerLinhasPlanilha } from './planilha';
import { LEAD_VAZIO, type LeadGrcc } from './tipos';

const LEAD: LeadGrcc = {
    ...LEAD_VAZIO,
    id: 7,
    cliente: 'Prefeitura de Indaiatuba',
    solicitacao: 'Consultoria',
    status: 'Proposta no cliente 12/06',
    categoria: 'No cliente',
    temperatura: 'quente',
    etapa: 'Proposta no cliente',
    situacao: 'Em andamento',
    motivoPerda: null,
    familiaDemanda: 'Consultoria',
    valor: 260758.68,
    uf: 'SP',
    municipio: 'Indaiatuba',
    regiao: 'Sudeste',
    contatoNome: 'Graziela',
    contatoEmail: 'g@indaiatuba.sp.gov.br',
    contatoTelefone: '(19) 0000-0000',
    previsaoFechamento: '2026-11-30',
    inicioFaturamento: '2027-01-01',
    duracaoMeses: 24,
    visivelDashboard: false,
    criadoEm: '2026-10-01T10:00:00.000Z',
    atualizadoEm: '2026-10-20T10:00:00.000Z',
};

/** O que o read-excel-file entregaria: só o `value` de cada célula. */
function comoMatriz(leads: LeadGrcc[]): unknown[][] {
    return planilhaDosLeads(leads).map((row) =>
        row.map((c) => (c !== null && typeof c === 'object' && 'value' in c ? c.value : c ?? null))
    );
}

describe('planilhaDosLeads', () => {
    it('volta igual pela importação', () => {
        const r = lerLinhasPlanilha(comoMatriz([LEAD]));
        expect(r.colunasFaltando).toEqual([]);
        expect(r.problemas).toEqual([]);
        const { id, visivelDashboard, criadoEm, atualizadoEm, ...dados } = LEAD;
        void id; void visivelDashboard; void criadoEm; void atualizadoEm;
        expect(r.linhas).toEqual([{ linha: 2, dados }]);
    });

    it('temperatura automática sai vazia e continua automática', () => {
        const r = lerLinhasPlanilha(comoMatriz([{ ...LEAD, temperatura: null }]));
        expect(r.linhas[0].dados.temperatura).toBeNull();
    });

    it('só cabeçalho quando não há leads', () => {
        expect(planilhaDosLeads([])).toHaveLength(1);
    });

    it('valor numérico e datas como Date', () => {
        const [, linha] = planilhaDosLeads([LEAD]);
        expect(linha).toContainEqual(expect.objectContaining({ value: 260758.68, type: Number }));
        expect(linha).toContainEqual(expect.objectContaining({ value: new Date(Date.UTC(2026, 10, 30)), type: Date }));
    });
});

describe('nomeArquivoExportacao', () => {
    it('junta filtros em slug e a data do dia', () => {
        expect(nomeArquivoExportacao(['Em tratativas', 'Quente', null, ''], new Date(2026, 9, 27))).toBe(
            'leads-grcc-em-tratativas-quente-2026-10-27.xlsx'
        );
        expect(nomeArquivoExportacao([], new Date(2026, 0, 5))).toBe('leads-grcc-2026-01-05.xlsx');
    });
});
