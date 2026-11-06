import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import * as s from '@/db/schema';
import { saveCXData, saveVisitsData, saveChurnData, saveManagerData, cloneManager, saveFaturamento2025Action } from './actions';
import { saveOrgChart } from './orgChartActions';
import { uploadPlannerTasks } from '@/services/planner-upload.service';

beforeAll(async () => {
    process.env.SETTINGS_KEY = 'adm';
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'g1', name: 'G', role: 'GRC1', avatarUrl: '', year: 2026, meta: 0, contratado: 0, forecastFinal: 0 });
});

const manager = { id: 'g1', name: 'Hack', role: 'GRC1', avatarUrl: '', year: 2026, meta: 0, contratado: 0, forecastFinal: 0, pipeline: { q1: { total: 0, projects: [] }, q2: { total: 0, projects: [] }, q3: { total: 0, projects: [] }, q4: { total: 0, projects: [] }, nao_mapeado: { total: 0, projects: [] } } };

describe('actions do /settings sem chave', () => {
    it.each([
        ['saveCXData', () => saveCXData('x', 'g1', [])],
        ['saveVisitsData', () => saveVisitsData('x', 'g1', [])],
        ['saveChurnData', () => saveChurnData('x', 'g1', [])],
        ['saveManagerData', () => saveManagerData('x', manager)],
        ['cloneManager', () => cloneManager('x', 'g1', 'Clone')],
        ['saveFaturamento2025Action', () => saveFaturamento2025Action('x', 1)],
        ['saveOrgChart', () => saveOrgChart('x', { director: { name: 'X' }, subdirectors: [], departments: [], version: '1' })],
        ['uploadPlannerTasks', () => uploadPlannerTasks('x', { tasks: [] })],
        ['uploadPlannerTasks sem chave', () => uploadPlannerTasks('', { tasks: [] })],
    ])('%s recusa', async (_n, chamar) => {
        await expect(chamar()).rejects.toThrow('Chave de administrador inválida.');
    });
    it('uploadPlannerTasks com chave passa da checagem e valida o corpo', async () => {
        expect(await uploadPlannerTasks('adm', { nada: 1 })).toMatchObject({ success: false, error: expect.stringContaining('JSON inválido') });
    });
    it('nada foi gravado', async () => {
        expect((await db.select().from(s.managers))[0].name).toBe('G');
    });
});
