import { describe, it, expect } from 'vitest';
import { projetoDoLead, temperaturaDaCategoria, trimestreDaPrevisao } from './pipeline';
import { CATEGORIAS_GRCC, LEAD_VAZIO, type LeadGrcc } from './tipos';

describe('temperaturaDaCategoria', () => {
    it('mapeia todas as categorias', () => {
        expect(Object.fromEntries(CATEGORIAS_GRCC.map((c) => [c, temperaturaDaCategoria(c)]))).toEqual({
            Novo: 'frio',
            'Validação': 'morno',
            Parceiro: 'morno',
            'Em tratativas': 'morno',
            'No cliente': 'quente',
            Contratado: 'contratado',
            Perda: 'perdido',
        });
    });
});

describe('trimestreDaPrevisao', () => {
    it.each([
        ['2026-01-15', 'q1'], ['2026-03-31', 'q1'], ['2026-04-01', 'q2'],
        ['2026-09-30', 'q3'], ['2026-12-01', 'q4'],
        ['2027-02-01', 'nao_mapeado'], [null, 'nao_mapeado'],
    ])('%s → %s', (previsao, q) => expect(trimestreDaPrevisao(previsao, 2026)).toBe(q));
});

describe('projetoDoLead', () => {
    const lead: LeadGrcc = {
        ...LEAD_VAZIO, id: 3, cliente: 'ALESP', solicitacao: 'Mensageria', status: 'Proposta no cliente',
        categoria: 'No cliente', valor: 10542439.43, previsaoFechamento: '2026-11-20',
        criadoEm: 'x', atualizadoEm: 'x',
    };
    it('gera o projeto da Débora', () => {
        expect(projetoDoLead(lead, { id: 'grcc-debora', year: 2026 })).toEqual({
            managerId: 'grcc-debora', quarter: 'q4', orgao: 'ALESP', name: 'Mensageria', value: 10542439.43,
            temperature: 'quente', description: 'Proposta no cliente', durationMonths: 12, startDate: null,
            leadGrccId: 3,
        });
    });
    it('solicitação vazia vira "Lead GRCC"; startDate só em Contratado', () => {
        const p = projetoDoLead({ ...lead, solicitacao: '', inicioFaturamento: '2026-11-01' }, { id: 'g', year: 2026 });
        expect(p.name).toBe('Lead GRCC');
        expect(p.startDate).toBeNull();
        const c = projetoDoLead({ ...lead, categoria: 'Contratado', inicioFaturamento: '2026-11-01', duracaoMeses: 24 }, { id: 'g', year: 2026 });
        expect(c).toMatchObject({ temperature: 'contratado', startDate: '2026-11-01', durationMonths: 24 });
    });
});
