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
    quarter: text('quarter', { enum: ['q1', 'q2', 'q3', 'q4'] }).notNull(),
    orgao: text('orgao'),
    name: text('name').notNull(),
    value: real('value').notNull(),
    temperature: text('temperature', { enum: ['quente', 'morno', 'frio'] }),
});
