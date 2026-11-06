import { describe, it, expect } from 'vitest';
import { fecharEsperaDeProposta, origemTemperatura, projetoDoLead, temperaturaDaCategoria, temperaturaDoLead, trimestreDaPrevisao } from './pipeline';
import { CATEGORIAS_GRCC, LEAD_VAZIO, type LeadGrcc, type LeadGrccDados } from './tipos';

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
        ['2026-13-01', 'nao_mapeado'], ['2026-00-10', 'nao_mapeado'], ['2026-99-01', 'nao_mapeado'], ['lixo', 'nao_mapeado'],
    ])('%s → %s', (previsao, q) => expect(trimestreDaPrevisao(previsao, 2026)).toBe(q));
});

describe('projetoDoLead', () => {
    const lead: LeadGrcc = {
        ...LEAD_VAZIO, visivelDashboard: true, id: 3, cliente: 'ALESP', solicitacao: 'Mensageria', status: 'Proposta no cliente',
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

describe('temperaturaDoLead', () => {
    const base = { categoria: 'Em tratativas' as const, temperatura: null, propostaEnviadaEm: null };

    it('sem data de envio e sem manual → automática pela categoria', () => {
        expect(temperaturaDoLead(base)).toBe('morno');
    });

    it('manual sempre vence, mesmo com data de envio', () => {
        expect(temperaturaDoLead({ ...base, temperatura: 'frio', propostaEnviadaEm: '2026-08-01' }, new Date('2026-08-15'))).toBe('frio');
    });

    it('antes de completar 2 meses corridos → quente', () => {
        expect(temperaturaDoLead({ ...base, propostaEnviadaEm: '2026-08-01' }, new Date('2026-09-30'))).toBe('quente');
    });

    it('ao completar 2 meses corridos → morno', () => {
        expect(temperaturaDoLead({ ...base, propostaEnviadaEm: '2026-08-01' }, new Date('2026-10-01'))).toBe('morno');
    });

    it('Contratado/Perda são fixos mesmo com data de envio', () => {
        expect(temperaturaDoLead({ categoria: 'Contratado', temperatura: null, propostaEnviadaEm: '2026-08-01' }, new Date('2026-08-05'))).toBe('contratado');
    });
});

describe('origemTemperatura', () => {
    it('classifica fixa, manual, proposta e categoria', () => {
        expect(origemTemperatura({ categoria: 'Contratado', temperatura: null, propostaEnviadaEm: null })).toBe('fixa');
        expect(origemTemperatura({ categoria: 'Novo', temperatura: 'frio', propostaEnviadaEm: '2026-08-01' })).toBe('manual');
        expect(origemTemperatura({ categoria: 'Novo', temperatura: null, propostaEnviadaEm: '2026-08-01' })).toBe('proposta');
        expect(origemTemperatura({ categoria: 'Novo', temperatura: null, propostaEnviadaEm: null })).toBe('categoria');
    });
});

describe('fecharEsperaDeProposta', () => {
    const base: LeadGrccDados = { ...LEAD_VAZIO, etapa: 'Proposta enviada', situacao: 'Aguardando', propostaEnviadaEm: '2026-08-01' };

    it('etapa mudou → zera a data de envio', () => {
        expect(fecharEsperaDeProposta(base, { ...base, etapa: 'Reunião agendada' }).propostaEnviadaEm).toBeNull();
    });

    it('situação mudou → zera a data de envio', () => {
        expect(fecharEsperaDeProposta(base, { ...base, situacao: 'Parado' }).propostaEnviadaEm).toBeNull();
    });

    it('nada mudou → mantém a data', () => {
        expect(fecharEsperaDeProposta(base, { ...base }).propostaEnviadaEm).toBe('2026-08-01');
    });

    it('etapa mudou mas a edição já trouxe data nova (reenvio) → mantém a data nova', () => {
        expect(fecharEsperaDeProposta(base, { ...base, etapa: 'Reunião agendada', propostaEnviadaEm: '2026-10-01' }).propostaEnviadaEm).toBe('2026-10-01');
    });

    it('etapa mudou e a edição já limpou a data manualmente → mantém limpa', () => {
        expect(fecharEsperaDeProposta(base, { ...base, etapa: 'Reunião agendada', propostaEnviadaEm: null }).propostaEnviadaEm).toBeNull();
    });
});
