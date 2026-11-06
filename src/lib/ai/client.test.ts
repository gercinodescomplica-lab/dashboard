import { describe, it, expect, afterEach } from 'vitest';
import { getAiClient, AI_MODEL } from './client';

const original = process.env.DEEPSEEK_API_KEY;
afterEach(() => {
    if (original === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = original;
});

describe('getAiClient', () => {
    it('lança erro legível sem DEEPSEEK_API_KEY', () => {
        delete process.env.DEEPSEEK_API_KEY;
        expect(() => getAiClient()).toThrow(/DEEPSEEK_API_KEY/);
    });

    it('com a chave, retorna um client com chat.completions', () => {
        process.env.DEEPSEEK_API_KEY = 'test-key';
        const client = getAiClient();
        expect(client.chat.completions).toBeDefined();
        expect(client.baseURL).toBe('https://api.deepseek.com');
    });

    it('AI_MODEL é deepseek-chat', () => {
        expect(AI_MODEL).toBe('deepseek-chat');
    });
});
