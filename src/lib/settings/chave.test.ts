import { describe, it, expect, afterEach } from 'vitest';
import { chaveSettingsValida } from './chave';

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe('chaveSettingsValida', () => {
    it('aceita SETTINGS_KEY, DIRETORIA_KEY e DIRECTORATE_KEY, com trim', () => {
        process.env.SETTINGS_KEY = 'adm';
        process.env.DIRETORIA_KEY = 'dir';
        process.env.DIRECTORATE_KEY = 'dte';
        expect(chaveSettingsValida(' adm ')).toBe(true);
        expect(chaveSettingsValida('dir')).toBe(true);
        expect(chaveSettingsValida('dte')).toBe(true);
        expect(chaveSettingsValida('outra')).toBe(false);
    });
    it('sem SETTINGS_KEY vale o padrão de hoje (prodam2026); não-texto e vazio recusam', () => {
        delete process.env.SETTINGS_KEY;
        delete process.env.DIRETORIA_KEY;
        delete process.env.DIRECTORATE_KEY;
        expect(chaveSettingsValida('prodam2026')).toBe(true);
        expect(chaveSettingsValida('')).toBe(false);
        expect(chaveSettingsValida(undefined)).toBe(false);
        expect(chaveSettingsValida(123)).toBe(false);
    });
});
