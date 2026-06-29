import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const managers = sqliteTable('managers', {
    id: text('id').primaryKey(), // "grc1-bruno"
    name: text('name').notNull(),
    role: text('role').notNull(),
    avatarUrl: text('avatarUrl').notNull(),
    year: integer('year').notNull(),
    meta: real('meta').notNull(),
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
