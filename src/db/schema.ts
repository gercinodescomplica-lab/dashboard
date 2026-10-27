import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const managers = sqliteTable('managers', {
    id: text('id').primaryKey(), // "grc1-bruno"
    name: text('name').notNull(),
    role: text('role').notNull(),
    avatarUrl: text('avatarUrl').notNull(),
    year: integer('year').notNull(),
    meta: real('meta').notNull(),
    metaNovosNegocios: real('meta_novos_negocios'),
    contratado: real('contratado').notNull(),
    forecastFinal: real('forecastFinal').notNull(),
    notes: text('notes'),
    servedClients: text('served_clients'), // JSON string of clients
    showInDashboard: integer('show_in_dashboard', { mode: 'boolean' }).notNull().default(true),
});

export const projects = sqliteTable('projects', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    managerId: text('manager_id').notNull().references(() => managers.id, { onDelete: 'cascade' }),
    quarter: text('quarter', { enum: ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] }).notNull(),
    orgao: text('orgao'),
    name: text('name').notNull(),
    value: real('value').notNull(),
    temperature: text('temperature', { enum: ['quente', 'morno', 'frio', 'contratado', 'historico', 'perdido'] }),
    description: text('description'),
    durationMonths: integer('duration_months').default(12),
    startDate: text('start_date'),
    billingStartMonth: integer('billing_start_month'),
    history: text('history'),
    // Projeto gerado a partir de um lead da GRCC (dono = /grcc). Nulo = projeto manual.
    leadGrccId: integer('lead_grcc_id').unique(),
});

export const cx = sqliteTable('cx', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    managerId: text('manager_id').notNull().references(() => managers.id, { onDelete: 'cascade' }),
    cliente: text('cliente').notNull(),
    titulo: text('titulo').notNull().default(''),
    problema: text('problema').notNull(),
    solucaoProposta: text('solucao_proposta').notNull(),
    status: text('status', { enum: ['pendente', 'analise', 'resolvido'] }).notNull().default('pendente'),
    criticidade: text('criticidade', { enum: ['baixa', 'media', 'alta'] }).notNull().default('baixa'),
    isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
    externalId: text('external_id'),
    // Marca (timestamp ISO) que um item vindo do Planner (tem externalId) foi
    // editado à mão no Settings desde o último sync — os campos que o Planner
    // controla (titulo/problema/status/criticidade) vão ser sobrescritos no
    // próximo sync, então isso avisa o admin disso. Nulo = em dia com o
    // Planner (ou item 100% manual, nunca veio de lá). Ver src/lib/planner-sync.ts
    // (limpa o campo a cada sync) e src/app/settings/actions.ts (seta o campo
    // quando detecta que um item sincronizado foi alterado antes de salvar).
    manualEditAt: text('manual_edit_at'),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const visits = sqliteTable('visits', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    managerId: text('manager_id').notNull().references(() => managers.id, { onDelete: 'cascade' }),
    titulo: text('titulo').notNull(),
    local: text('local').notNull(),
    motivo: text('motivo').notNull(),
    data: text('data').notNull(), // ISO date string: "2025-03-06"
    dataFim: text('data_fim'), // Nullable ISO date string ending
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const storeProducts = sqliteTable('store_products', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    directorate: text('directorate').notNull(),
    status: text('status').notNull(),
    phase: text('phase').notNull(),
    marketplace: integer('marketplace', { mode: 'boolean' }).notNull().default(false),
    category: text('category').notNull(),
    responsavel: text('responsavel'),
});

export const dropdownOptions = sqliteTable('dropdown_options', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    field: text('field').notNull(),
    value: text('value').notNull(),
});

export const contrato = sqliteTable('contrato', {
    id: text('id').primaryKey(),
    numeroContrato: text('numero_contrato').notNull().unique(),
    protheus: text('protheus'),
    cliente: text('cliente').notNull(),
    desde: text('desde'),
    dtInicioVigencia: text('dt_inicio_vigencia'),
    dtFimVigencia: text('dt_fim_vigencia'),
    vlContratado: real('vl_contratado'),
    vlFaturado: real('vl_faturado'),
    vlSaldo: real('vl_saldo'),
    tipo: text('tipo'),
    situacao: text('situacao'),
    vigente: integer('vigente', { mode: 'boolean' }),
    diretoria: text('diretoria'),
    gerencia: text('gerencia'),
    nomeGerente: text('nome_gerente'),
    objeto: text('objeto'),
    managerId: text('manager_id').references(() => managers.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const orgChart = sqliteTable('org_chart', {
    id: integer('id').primaryKey(),
    data: text('data').notNull(),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const proposta = sqliteTable('proposta', {
    id: text('id').primaryKey(),
    numeroProposta: text('numero_proposta').notNull().unique(),
    nomeOportunidade: text('nome_oportunidade').notNull(),
    proprietario: text('proprietario'),
    cliente: text('cliente').notNull(),
    fase: text('fase'),
    valor: real('valor'),
    receitaEsperada: real('receita_esperada'),
    probabilidade: real('probabilidade'),
    duracao: integer('duracao'),
    dataCriacao: text('data_criacao'),
    dataFechamento: text('data_fechamento'),
    gerencia: text('gerencia'),
    managerId: text('manager_id').references(() => managers.id, { onDelete: 'set null' }),
    status: text('status'),
    observacao: text('observacao'),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const systemSettings = sqliteTable('system_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const churn = sqliteTable('churn', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    managerId: text('manager_id').notNull().references(() => managers.id, { onDelete: 'cascade' }),
    numeroContrato: text('numero_contrato').notNull(),
    valor: real('valor').notNull(),
    descricao: text('descricao').notNull(),
    motivo: text('motivo').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const leadGrcc = sqliteTable('lead_grcc', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cliente: text('cliente').notNull(),
    solicitacao: text('solicitacao').notNull().default(''),
    status: text('status'),
    categoria: text('categoria').notNull().default('Novo'),
    temperatura: text('temperatura'), // 'quente' | 'morno' | 'frio' | null (null = automático pela categoria)
    etapa: text('etapa'),
    situacao: text('situacao'),
    motivoPerda: text('motivo_perda'),
    familiaDemanda: text('familia_demanda'),
    valor: real('valor').notNull().default(0),
    uf: text('uf'),
    municipio: text('municipio'),
    regiao: text('regiao'),
    contatoNome: text('contato_nome'),
    contatoEmail: text('contato_email'),
    contatoTelefone: text('contato_telefone'),
    previsaoFechamento: text('previsao_fechamento'), // "YYYY-MM-DD"
    inicioFaturamento: text('inicio_faturamento'), // "YYYY-MM-DD", só Contratado
    duracaoMeses: integer('duracao_meses').notNull().default(12),
    // Aparece no dashboard (aba Cidades). Não faz parte dos dados da planilha: só o formulário da /grcc muda.
    visivelDashboard: integer('visivel_dashboard', { mode: 'boolean' }).notNull().default(true),
    criadoEm: text('criado_em').notNull(),
    atualizadoEm: text('atualizado_em').notNull(),
    excluidoEm: text('excluido_em'), // soft delete
});

// Somente acréscimo: nada atualiza nem apaga linhas daqui.
export const leadGrccHistorico = sqliteTable('lead_grcc_historico', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id').notNull().references(() => leadGrcc.id),
    quando: text('quando').notNull(),
    origem: text('origem', { enum: ['cadastro', 'edicao', 'importacao', 'exclusao', 'correcao', 'remocao'] }).notNull(),
    arquivo: text('arquivo'),
    autor: text('autor').notNull(),
    mudancas: text('mudancas').notNull(), // JSON: [{ campo, de, para }]
    // Só em correcao/remocao: o evento cujo andamento foi ajustado (ele mesmo nunca é alterado).
    corrigeId: integer('corrige_id'),
});


