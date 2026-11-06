import { describe, it, expect, vi } from 'vitest';
import { runAiTurn } from './run';

// Stream falso que sempre pede uma ferramenta — simula o modelo que nunca para.
function streamPedindoFerramenta() {
    return (async function* () {
        yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 't1', function: { name: 'listar_gerentes', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] };
    })();
}

describe('runAiTurn', () => {
    it('na última volta desliga as ferramentas pra garantir uma resposta', async () => {
        const create = vi.fn().mockImplementation(async () => streamPedindoFerramenta());
        const client = { chat: { completions: { create } } } as never;
        const events = [];
        for await (const ev of runAiTurn({
            client, model: 'm', systemPrompt: 's', history: [], userMessage: 'oi',
            tools: [], runTool: async () => ({}), maxIters: 3,
        })) events.push(ev);

        expect(create).toHaveBeenCalledTimes(3);
        expect(create.mock.calls[0][0].tool_choice).toBeUndefined();
        expect(create.mock.calls[2][0].tool_choice).toBe('none');
        expect(events.at(-1)).toMatchObject({ type: 'final' });
    });
});
