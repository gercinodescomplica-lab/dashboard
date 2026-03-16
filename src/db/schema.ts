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
});

export const projects = sqliteTable('projects', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    managerId: text('manager_id').notNull().references(() => managers.id, { onDelete: 'cascade' }),
    quarter: text('quarter', { enum: ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] }).notNull(),
    orgao: text('orgao'),
    name: text('name').notNull(),
    value: real('value').notNull(),
    temperature: text('temperature', { enum: ['quente', 'morno', 'frio'] }),
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
