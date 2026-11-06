import type { OpportunityTemperature } from '@/types/manager';
import type { CategoriaGrcc, LeadGrcc, LeadGrccDados } from './tipos';

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

function dataLimiteProposta(dataEnvio: string): number {
    const [y, m, d] = dataEnvio.split('-').map(Number);
    return Date.UTC(y, m - 1 + 2, d);
}

function temperaturaPelaProposta(dataEnvio: string, agora: Date): OpportunityTemperature {
    return agora.getTime() >= dataLimiteProposta(dataEnvio) ? 'morno' : 'quente';
}

/**
 * Temperatura que o lead leva ao pipeline. Contratado/Perda mandam sempre; nos demais vale a
 * temperatura escolhida no cadastro; se vazia e houver data de envio da proposta, quente por 2
 * meses corridos e depois morno; sem nada disso, a automática pela categoria.
 */
export function temperaturaDoLead(
    lead: Pick<LeadGrccDados, 'categoria' | 'temperatura' | 'propostaEnviadaEm'>,
    agora: Date = new Date()
): OpportunityTemperature {
    if (lead.categoria === 'Contratado' || lead.categoria === 'Perda') return temperaturaDaCategoria(lead.categoria);
    if (lead.temperatura) return lead.temperatura;
    if (lead.propostaEnviadaEm) return temperaturaPelaProposta(lead.propostaEnviadaEm, agora);
    return temperaturaDaCategoria(lead.categoria);
}

/** De onde vem a temperatura mostrada — só para texto explicativo na UI (tooltip). */
export function origemTemperatura(
    lead: Pick<LeadGrccDados, 'categoria' | 'temperatura' | 'propostaEnviadaEm'>
): 'fixa' | 'manual' | 'proposta' | 'categoria' {
    if (lead.categoria === 'Contratado' || lead.categoria === 'Perda') return 'fixa';
    if (lead.temperatura) return 'manual';
    if (lead.propostaEnviadaEm) return 'proposta';
    return 'categoria';
}

/**
 * Mudar etapa ou situação conta como "o cliente retornou": fecha a espera da proposta (zera a
 * data), a menos que a própria edição já tenha trazido uma data de envio diferente (reenvio).
 */
export function fecharEsperaDeProposta(atual: LeadGrccDados, dados: LeadGrccDados): LeadGrccDados {
    if (dados.propostaEnviadaEm !== atual.propostaEnviadaEm) return dados;
    if (atual.etapa === dados.etapa && atual.situacao === dados.situacao) return dados;
    return { ...dados, propostaEnviadaEm: null };
}

export function trimestreDaPrevisao(previsao: string | null, anoGerente: number): Trimestre {
    if (!previsao) return 'nao_mapeado';
    const [ano, mes] = previsao.split('-').map(Number);
    if (ano !== anoGerente || !Number.isInteger(mes) || mes < 1 || mes > 12) return 'nao_mapeado';
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
        temperature: temperaturaDoLead(lead),
        description: lead.status,
        durationMonths: lead.duracaoMeses,
        startDate: lead.categoria === 'Contratado' ? lead.inicioFaturamento : null,
        leadGrccId: lead.id,
    };
}
