import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import { managers } from '@/db/schema';
import { buildSystemPrompt } from './prompt';

beforeAll(async () => {
    await applyMigrations();
    await db.insert(managers).values({
        id: 'm-prompt', name: 'Zezinho Prompt', role: 'GRC-2', avatarUrl: '', year: 2026,
        meta: 1_000_000, contratado: 500_000, forecastFinal: 0, showInDashboard: true,
    });
});

describe('buildSystemPrompt', () => {
    it('inclui o guia, um gerente seedado e a regra de somente leitura', async () => {
        const prompt = await buildSystemPrompt();
        expect(prompt).toContain('GRC');
        expect(prompt).toContain('Zezinho Prompt');
        expect(prompt).toMatch(/somente leitura/i);
        expect(prompt).toContain('RESUMO DA DRM');
    });

    it('não menciona Painel do Diretor nem criticidade crítica (fora do escopo desta branch)', async () => {
        const prompt = await buildSystemPrompt();
        expect(prompt).not.toMatch(/painel do diretor/i);
        expect(prompt).not.toMatch(/critica\)/i);
    });
});
