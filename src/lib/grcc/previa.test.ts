import { describe, it, expect } from 'vitest';
import { montarPrevia } from './previa';
import { LEAD_VAZIO, type LeadGrcc } from './tipos';

const existente: LeadGrcc = {
    ...LEAD_VAZIO, visivelDashboard: true, id: 7, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', valor: 100,
    criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z',
};

describe('montarPrevia', () => {
    it('classifica novo, alterado e igual (casando cliente+solicitação normalizados)', () => {
        const p = montarPrevia(
            [
                { linha: 2, dados: { ...existente, cliente: 'PREFEITURA DE INDAIATUBA', valor: 150 } },
                { linha: 3, dados: { ...LEAD_VAZIO, cliente: 'Novo cliente', valor: 5 } },
            ],
            [{ linha: 9, cliente: 'X', motivo: 'Cliente vazio' }],
            [existente]
        );
        expect(p.novos.map((n) => n.linha)).toEqual([3]);
        expect(p.alterados).toHaveLength(1);
        expect(p.alterados[0].leadId).toBe(7);
        expect(p.alterados[0].mudancas.map((m) => m.campo)).toEqual(['cliente', 'valor']);
        expect(p.iguais).toBe(0);
        expect(p.problemas).toEqual([{ linha: 9, cliente: 'X', motivo: 'Cliente vazio' }]);
    });

    it('linha idêntica conta como igual', () => {
        const { id: _i, criadoEm: _c, atualizadoEm: _a, ...dados } = existente;
        const p = montarPrevia([{ linha: 2, dados }], [], [existente]);
        expect(p).toEqual({ novos: [], alterados: [], iguais: 1, problemas: [] });
    });

    it('nunca marca exclusão: leads ausentes da planilha não aparecem', () => {
        const p = montarPrevia([], [], [existente]);
        expect(p).toEqual({ novos: [], alterados: [], iguais: 0, problemas: [] });
    });

    it('planilha sem data de envio não apaga a que foi registrada na tela', () => {
        const comData: LeadGrcc = { ...existente, propostaEnviadaEm: '2026-09-01' };
        const { propostaEnviadaEm: _p, ...semData } = existente;
        void _p;
        const p = montarPrevia([{ linha: 2, dados: { ...semData, propostaEnviadaEm: null, valor: 999 } }], [], [comData]);
        expect(p.alterados).toHaveLength(1);
        expect(p.alterados[0].dados.propostaEnviadaEm).toBe('2026-09-01');
    });
});

describe('montarPrevia — contatos extras', () => {
    it('planilha (sem contatos extras) não apaga os já cadastrados', () => {
        const comExtras: LeadGrcc = { ...existente, contatosExtras: [{ nome: 'Ana', email: null, telefone: null }] };
        const { id: _i, criadoEm: _c, atualizadoEm: _a, visivelDashboard: _v, ...dados } = existente;
        const p = montarPrevia([{ linha: 2, dados: { ...dados, contatosExtras: [] } }], [], [comExtras]);
        expect(p.iguais).toBe(1);
    });
});
