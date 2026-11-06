import type OpenAI from 'openai';

export type AiTurnEvent =
    | { type: 'delta'; text: string }
    | { type: 'tool'; name: string }
    | { type: 'final'; text: string };

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

interface RunAiTurnDeps {
    client: Pick<OpenAI, 'chat'>;
    model: string;
    systemPrompt: string;
    history: ChatMessage[];
    userMessage: string;
    tools: OpenAI.Chat.Completions.ChatCompletionFunctionTool[];
    runTool: (name: string, args: unknown) => Promise<unknown>;
    maxIters?: number;
}

// Loop de tool-calling com streaming. Faz stream do texto do assistente pro
// chamador (eventos 'delta'), executa as ferramentas que o modelo pedir
// (eventos 'tool'), e repete até o modelo parar de pedir ferramentas ou bater
// o teto de iterações. Emite um 'final' com o texto acumulado no fim.
export async function* runAiTurn(deps: RunAiTurnDeps): AsyncGenerator<AiTurnEvent> {
    const { client, model, systemPrompt, history, userMessage, tools, runTool } = deps;
    const maxIters = deps.maxIters ?? 8;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
    ];

    let fullText = '';

    for (let iter = 0; iter < maxIters; iter++) {
        // Última volta sem ferramentas: obriga o modelo a responder com o que já leu
        // (antes, bater o teto deixava o usuário sem resposta). Temperatura baixa = menos invenção.
        const lastIter = iter === maxIters - 1;
        const stream = await client.chat.completions.create({
            model, messages, stream: true, temperature: 0.3,
            tools, ...(lastIter ? { tool_choice: 'none' as const } : {}),
        });

        let content = '';
        const toolCalls: { id: string; name: string; args: string }[] = [];
        let finishReason: string | null = null;

        for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
            const choice = chunk.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta;

            if (delta?.content) {
                content += delta.content;
                fullText += delta.content;
                yield { type: 'delta', text: delta.content };
            }

            for (const tc of delta?.tool_calls ?? []) {
                const idx = tc.index ?? 0;
                toolCalls[idx] ??= { id: '', name: '', args: '' };
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
            }

            if (choice.finish_reason) finishReason = choice.finish_reason;
        }

        if (finishReason !== 'tool_calls' || toolCalls.length === 0) {
            break;
        }

        // Registra a "vez" do assistente (com os tool_calls) e as respostas das ferramentas.
        messages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls.map((t) => ({
                id: t.id, type: 'function' as const,
                function: { name: t.name, arguments: t.args || '{}' },
            })),
        });

        for (const tc of toolCalls) {
            yield { type: 'tool', name: tc.name };
            let parsed: unknown = {};
            try { parsed = tc.args ? JSON.parse(tc.args) : {}; } catch { parsed = {}; }
            const result = await runTool(tc.name, parsed);
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
    }

    yield { type: 'final', text: fullText };
}
