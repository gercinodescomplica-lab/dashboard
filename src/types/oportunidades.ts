/**
 * Tipos do bloco "Oportunidades em Risco" exibido no fim da tela inicial de cada gerente.
 *
 * Fonte de dados HOJE: `src/data/oportunidades-consolidado.json` (levantamento estático).
 * Fonte AMANHÃ: tabela no banco — o contrato abaixo é o formato de saída do service
 * (`getOportunidadesRisco`), então a UI não precisa mudar quando a origem trocar.
 */

export type OportunidadeStatus =
  | 'em_risco'
  | 'pendente'
  | 'em_negociacao'
  | 'em_customizacao'
  | 'nao_avancou'
  | 'perdida';

/**
 * Causa raiz do não avanço. Os valores conhecidos hoje estão listados, mas o tipo
 * aceita string porque o levantamento é manual e novas categorias podem aparecer —
 * a UI faz fallback legível para qualquer valor desconhecido.
 */
export type OportunidadeCausaRaiz =
  | 'demora_interna'
  | 'descasamento_produto'
  | 'descasamento_escopo'
  | 'concorrencia_licitacao'
  | 'precificacao'
  | 'estruturacao_tecnica'
  | 'tempo_resposta'
  | 'falta_estrutura_produto'
  | 'falta_produto'
  | 'falta_produto_interno'
  | (string & {});

export interface Oportunidade {
  /** Órgão/cliente dono da oportunidade (ex: "SEGES", "Detran São Paulo"). */
  orgao: string;
  /** Produto ou tema em disputa (ex: "IA – Pesquisa de Preços"). */
  produtoTema: string;
  /** `null` = não informado no levantamento (diferente de "não tinha"). */
  tinhaPropostaFormal: boolean | null;
  /** Valor indicado no levantamento; `null` quando não houve valor informado. */
  valorIndicado: number | null;
  envolvidos: string[];
  /** Área interna que travou a oportunidade (ex: "DIT"); `null` quando não há. */
  areaBloqueadora: string | null;
  status: OportunidadeStatus;
  causaRaiz: OportunidadeCausaRaiz;
  descricao: string;
}

export interface OportunidadesRiscoData {
  /** Identificador da gerência usado no levantamento (ex: "KAM1", "GRCC"). */
  gerencia: string;
  /** Nome do gerente como veio no levantamento. */
  gerenteNome: string;
  /** Data da coleta com o gerente ("YYYY-MM-DD") ou `null`. */
  dataColeta: string | null;
  /** Título do levantamento (ex: "Oportunidades não avançadas ou pendentes por falha interna"). */
  levantamento: string;
  /** Data de consolidação do levantamento ("YYYY-MM-DD") ou `null`. */
  dataConsolidacao: string | null;
  oportunidades: Oportunidade[];
}

/** Oportunidade com a gerência de origem — usado nas visões consolidadas (DRM). */
export interface OportunidadeComGerencia extends Oportunidade {
  gerencia: string;
  gerenteNome: string;
  dataColeta: string | null;
}

/** Totais de uma gerência no levantamento consolidado. */
export interface OportunidadesRiscoPorGerencia {
  gerencia: string;
  gerenteNome: string;
  total: number;
  /** Soma dos valores indicados desta gerência (0 quando nenhum item tem valor). */
  valorIndicado: number;
}

/** Agregado de todas as gerências — KPI + modal do dashboard principal. */
export interface OportunidadesRiscoConsolidado {
  levantamento: string;
  dataConsolidacao: string | null;
  /** Total de oportunidades do levantamento (não avançadas ou pendentes por falha interna). */
  total: number;
  /** Quantas gerências têm levantamento. */
  totalGerentes: number;
  /** Soma dos valores indicados — atenção: só parte dos itens traz valor preenchido. */
  valorIndicadoTotal: number;
  /** Contagem por status, na ordem de criticidade. */
  porStatus: Array<{ status: OportunidadeStatus; total: number }>;
  porGerencia: OportunidadesRiscoPorGerencia[];
  oportunidades: OportunidadeComGerencia[];
}
