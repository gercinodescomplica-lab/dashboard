/**
 * Tipos e constantes do cadastro de leads da GRCC (/grcc). Sem lógica — regras ficam nos
 * módulos vizinhos (normalizar, planilha, diff, validacao, previa, pipeline).
 */

export const CATEGORIAS_GRCC = [
    'Novo',
    'Validação',
    'Parceiro',
    'Em tratativas',
    'No cliente',
    'Contratado',
    'Perda',
] as const;

export type CategoriaGrcc = (typeof CATEGORIAS_GRCC)[number];

/** Campos editáveis de um lead (tudo menos id e carimbos de data). */
export interface LeadGrccDados {
    cliente: string;
    solicitacao: string;
    status: string | null;
    categoria: CategoriaGrcc;
    etapa: string | null;
    situacao: string | null;
    motivoPerda: string | null;
    familiaDemanda: string | null;
    valor: number;
    uf: string | null;
    municipio: string | null;
    regiao: string | null;
    contatoNome: string | null;
    contatoEmail: string | null;
    contatoTelefone: string | null;
    previsaoFechamento: string | null;
    inicioFaturamento: string | null;
    duracaoMeses: number;
}

export interface LeadGrcc extends LeadGrccDados {
    id: number;
    criadoEm: string;
    atualizadoEm: string;
}

/** Ordem canônica dos campos — usada pelo diff e pelos rótulos do histórico. */
export const CAMPOS_LEAD: (keyof LeadGrccDados)[] = [
    'cliente',
    'solicitacao',
    'status',
    'categoria',
    'etapa',
    'situacao',
    'motivoPerda',
    'familiaDemanda',
    'valor',
    'uf',
    'municipio',
    'regiao',
    'contatoNome',
    'contatoEmail',
    'contatoTelefone',
    'previsaoFechamento',
    'inicioFaturamento',
    'duracaoMeses',
];

export const ROTULO_CAMPO: Record<keyof LeadGrccDados, string> = {
    cliente: 'Cliente',
    solicitacao: 'Solicitação',
    status: 'Andamento',
    categoria: 'Categoria',
    etapa: 'Etapa',
    situacao: 'Situação',
    motivoPerda: 'Motivo da perda',
    familiaDemanda: 'Família da demanda',
    valor: 'Valor',
    uf: 'UF',
    municipio: 'Município',
    regiao: 'Região',
    contatoNome: 'Contato',
    contatoEmail: 'E-mail',
    contatoTelefone: 'Telefone',
    previsaoFechamento: 'Previsão de fechamento',
    inicioFaturamento: 'Início do faturamento',
    duracaoMeses: 'Duração (meses)',
};

/** Campos que têm lista suspensa em `dropdown_options` (field = `grcc_<campo>`). */
export const CAMPOS_LISTA = ['categoria', 'etapa', 'situacao', 'motivoPerda', 'familiaDemanda'] as const;
export type CampoLista = (typeof CAMPOS_LISTA)[number];
export const FIELD_DA_LISTA: Record<CampoLista, string> = {
    categoria: 'grcc_categoria',
    etapa: 'grcc_etapa',
    situacao: 'grcc_situacao',
    motivoPerda: 'grcc_motivo',
    familiaDemanda: 'grcc_familia',
};

/** Campos com destaque (chip "de → para") no histórico. */
export const CAMPOS_DESTAQUE: (keyof LeadGrccDados)[] = ['categoria', 'etapa', 'situacao', 'motivoPerda'];

export interface Mudanca {
    campo: keyof LeadGrccDados;
    de: string | number | null;
    para: string | number | null;
}

export type OrigemEvento = 'cadastro' | 'edicao' | 'importacao' | 'exclusao';

export interface EventoHistorico {
    id: number;
    leadId: number;
    quando: string;
    origem: OrigemEvento;
    arquivo: string | null;
    autor: string;
    mudancas: Mudanca[];
}

export interface Movimentacao extends EventoHistorico {
    cliente: string;
    solicitacao: string;
}

/** Uma linha da planilha já normalizada. `linha` = número da linha no Excel (1 = cabeçalho). */
export interface LinhaPlanilha {
    linha: number;
    dados: LeadGrccDados;
}

export interface ProblemaLinha {
    linha: number;
    cliente: string;
    motivo: string;
}

export interface ResultadoPlanilha {
    linhas: LinhaPlanilha[];
    problemas: ProblemaLinha[];
    /** Colunas obrigatórias ausentes do cabeçalho — se não vazio, a planilha é recusada. */
    colunasFaltando: string[];
}

export interface ItemAlterado {
    linha: number;
    leadId: number;
    dados: LeadGrccDados;
    mudancas: Mudanca[];
}

export interface Previa {
    novos: LinhaPlanilha[];
    alterados: ItemAlterado[];
    iguais: number;
    problemas: ProblemaLinha[];
}

export interface UltimoImport {
    arquivo: string;
    quando: string;
    novos: number;
    alterados: number;
}

export interface ProjetoManual {
    id: number;
    orgao: string | null;
    name: string;
    value: number;
    quarter: string;
}

export const LEAD_VAZIO: LeadGrccDados = {
    cliente: '',
    solicitacao: '',
    status: null,
    categoria: 'Novo',
    etapa: null,
    situacao: null,
    motivoPerda: null,
    familiaDemanda: null,
    valor: 0,
    uf: null,
    municipio: null,
    regiao: null,
    contatoNome: null,
    contatoEmail: null,
    contatoTelefone: null,
    previsaoFechamento: null,
    inicioFaturamento: null,
    duracaoMeses: 12,
};
