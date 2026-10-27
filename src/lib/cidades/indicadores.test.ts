import { describe, it, expect } from 'vitest';
import { contarCidades, leadsDoIndicador, mesDoLead, somaValor } from './indicadores';
import type { LeadCidade } from '@/types/cidades';

const l = (id: number, p: Partial<LeadCidade>): LeadCidade => ({
    id, cliente: `C${id}`, solicitacao: '', status: '', categoria: 'Novo', valor: 0, uf: 'SP', municipio: 'Campinas', ...p,
});

const agora = new Date(2026, 9, 26); // 26/10/2026
const leads = [
    l(1, { valor: 100, previsao_fechamento: '2026-10-30' }),
    l(2, { valor: 50, previsao_fechamento: '2026-10-05', categoria: 'Perda' }),
    l(3, { valor: 300, previsao_fechamento: '2026-12-15', municipio: 'Santos' }),
    l(4, { valor: 10, previsao_fechamento: '2027-06-01', uf: 'PR', municipio: 'Curitiba' }),
    l(5, { valor: 0, municipio: '#VALUE!' }),
];

describe('leadsDoIndicador', () => {
    it('pipeline/ticket: só ativos, maior valor primeiro', () => {
        expect(leadsDoIndicador(leads, 'pipeline', agora).map((x) => x.id)).toEqual([3, 1, 4, 5]);
        expect(leadsDoIndicador(leads, 'ticket', agora).map((x) => x.id)).toEqual([3, 1, 4, 5]);
    });

    it('mês atual e próximos 90 dias não contam Perda', () => {
        expect(leadsDoIndicador(leads, 'mes', agora).map((x) => x.id)).toEqual([1]);
        expect(leadsDoIndicador(leads, 'prox90', agora).map((x) => x.id)).toEqual([1, 3]);
    });

    it('barra de um mês lista os ativos daquele mês', () => {
        expect(leadsDoIndicador(leads, { mes: '2026-10' }, agora).map((x) => x.id)).toEqual([1]);
    });

    it('cidades ignora município inválido e bate com a contagem', () => {
        const r = leadsDoIndicador(leads, 'cidades', agora);
        expect(r.map((x) => x.id)).toEqual([4, 1, 2, 3]);
        expect(contarCidades(leads)).toBe(3);
    });

    it('total traz todos e a soma confere', () => {
        expect(leadsDoIndicador(leads, 'total', agora)).toHaveLength(5);
        expect(somaValor(leadsDoIndicador(leads, 'prox90', agora))).toBe(400);
        expect(mesDoLead(leads[4])).toBeNull();
    });
});
