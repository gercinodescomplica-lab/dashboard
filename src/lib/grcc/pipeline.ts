import type { OpportunityTemperature } from '@/types/manager';
import type { CategoriaGrcc, LeadGrcc } from './tipos';

type Trimestre = 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado';

const TEMPERATURA: Record<CategoriaGrcc, OpportunityTemperature> = {
    Novo: 'frio',
    'Validação': 'morno',
    Parceiro: 'morno',
    'Em tratativas': 'morno',
    'No cliente': 'quente',
    Contratado: 'contratado',
    Perda: 'perdido',
};

export function temperaturaDaCategoria(c: CategoriaGrcc): OpportunityTemperature {
    return TEMPERATURA[c] ?? 'frio';
}

export function trimestreDaPrevisao(previsao: string | null, anoGerente: number): Trimestre {
    if (!previsao) return 'nao_mapeado';
    const [ano, mes] = previsao.split('-').map(Number);
    if (ano !== anoGerente || !mes) return 'nao_mapeado';
    return (['q1', 'q2', 'q3', 'q4'] as const)[Math.floor((mes - 1) / 3)];
}

export interface ProjetoGerado {
    managerId: string;
    quarter: Trimestre;
    orgao: string;
    name: string;
    value: number;
    temperature: OpportunityTemperature;
    description: string | null;
    durationMonths: number;
    startDate: string | null;
    leadGrccId: number;
}

/** Projeto do pipeline da Débora gerado a partir de um lead (dono = /grcc). */
export function projetoDoLead(lead: LeadGrcc, gerente: { id: string; year: number }): ProjetoGerado {
    return {
        managerId: gerente.id,
        quarter: trimestreDaPrevisao(lead.previsaoFechamento, gerente.year),
        orgao: lead.cliente,
        name: lead.solicitacao || 'Lead GRCC',
        value: lead.valor,
        temperature: temperaturaDaCategoria(lead.categoria),
        description: lead.status,
        durationMonths: lead.duracaoMeses,
        startDate: lead.categoria === 'Contratado' ? lead.inicioFaturamento : null,
        leadGrccId: lead.id,
    };
}
