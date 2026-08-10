export interface LeadCidade {
    id: number;
    cliente: string;
    solicitacao: string;
    status: string;
    categoria: string;
    valor: number;
    uf: string;
    municipio: string;
    regiao?: string;
    contato_nome?: string;
    contato_email?: string;
    contato_telefone?: string;
    previsao_fechamento?: string;
}

export interface CidadesSummary {
    totalLeads: number;
    pipelineTotal: number;
    ticketMedio: number;
    previsaoMesAtual: number;
    proximos90Dias: number;
    leadsSemUf: number;
}

export interface CategoriaStat {
    categoria: string;
    count: number;
    valor: number;
}

export interface UfStat {
    uf: string;
    count: number;
    valor: number;
}

export interface MunicipioPin {
    uf: string;
    municipio: string;
    lat: number;
    lng: number;
    count: number;
    valor: number;
}

export interface TimelineStat {
    mes: string; // YYYY-MM
    label: string; // Ex: Set/26
    valor: number;
    acumulado: number;
}
