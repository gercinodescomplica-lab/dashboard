import { extractLeadDate } from '@/lib/grcc/normalizar';
import type { LeadCidade } from '@/types/cidades';

/**
 * Quais leads formam cada número da aba Cidades. KPI e modal de detalhe usam a MESMA função,
 * então o total do card sempre bate com a soma da lista que abre ao clicar.
 */

export type Indicador = 'total' | 'cidades' | 'pipeline' | 'ticket' | 'mes' | 'prox90' | { mes: string };

export function ehPerda(l: LeadCidade): boolean {
    return (l.categoria || '').trim().toLowerCase() === 'perda';
}

/** Chave do mês (`YYYY-MM`) da previsão de fechamento, ou null sem data. */
export function mesDoLead(l: LeadCidade): string | null {
    const d = extractLeadDate(l);
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
}

function municipioValido(l: LeadCidade): boolean {
    const m = (l.municipio || '').trim();
    return !!m && m !== '#VALUE!' && m !== '#VALOR!';
}

export function chaveCidade(l: LeadCidade): string {
    return `${l.municipio.trim().toLowerCase()}_${(l.uf || '').toLowerCase()}`;
}

const porValor = (a: LeadCidade, b: LeadCidade) => b.valor - a.valor || a.cliente.localeCompare(b.cliente);
const porData = (a: LeadCidade, b: LeadCidade) =>
    (extractLeadDate(a)?.getTime() ?? 0) - (extractLeadDate(b)?.getTime() ?? 0) || porValor(a, b);

/** Leads de um indicador, já na ordem em que devem aparecer. Previsões (mês, 90 dias, barra do mês) não contam Perda. */
export function leadsDoIndicador(leads: LeadCidade[], ind: Indicador, agora = new Date()): LeadCidade[] {
    const ativos = leads.filter((l) => !ehPerda(l));
    if (typeof ind === 'object') return ativos.filter((l) => mesDoLead(l) === ind.mes).sort(porData);
    switch (ind) {
        case 'total':
            return [...leads].sort(porValor);
        case 'cidades':
            return leads
                .filter(municipioValido)
                .sort((a, b) => a.uf.localeCompare(b.uf) || a.municipio.localeCompare(b.municipio, 'pt-BR') || porValor(a, b));
        case 'pipeline':
        case 'ticket':
            return [...ativos].sort(porValor);
        case 'mes': {
            const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
            return ativos.filter((l) => mesDoLead(l) === mes).sort(porData);
        }
        case 'prox90': {
            const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            const limite = new Date(agora);
            limite.setDate(limite.getDate() + 90);
            return ativos
                .filter((l) => {
                    const d = extractLeadDate(l);
                    return !!d && d >= inicio && d <= limite;
                })
                .sort(porData);
        }
    }
}

export function somaValor(leads: LeadCidade[]): number {
    return leads.reduce((acc, l) => acc + (l.valor || 0), 0);
}

export function contarCidades(leads: LeadCidade[]): number {
    return new Set(leads.filter(municipioValido).map(chaveCidade)).size;
}
