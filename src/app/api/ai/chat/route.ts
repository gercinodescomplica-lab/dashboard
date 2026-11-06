import { getAiClient, AI_MODEL } from '@/lib/ai/client';
import { AI_TOOLS, runAiTool } from '@/lib/ai/tools';
import { buildSystemPrompt } from '@/lib/ai/prompt';
import { runAiTurn } from '@/lib/ai/run';
import type OpenAI from 'openai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
    let body: { message?: string; history?: { role: 'user' | 'assistant'; content: string }[] };
    try {
        body = await request.json();
    } catch {
        return new Response('json inválido', { status: 400 });
    }
    const message = (body.message ?? '').trim();
    if (!message) return new Response('mensagem vazia', { status: 400 });

    let client: Pick<OpenAI, 'chat'>;
    try {
        client = getAiClient();
    } catch (err) {
        return new Response(err instanceof Error ? err.message : 'IA indisponível', { status: 503 });
    }

    const systemPrompt = await buildSystemPrompt();
    const history = (body.history ?? []).map((m) => ({ role: m.role, content: m.content }));

    const encoder = new TextEncoder();
    const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    const stream = new ReadableStream({
        async start(controller) {
            try {
                for await (const ev of runAiTurn({
                    client, model: AI_MODEL, systemPrompt, history, userMessage: message,
                    tools: AI_TOOLS, runTool: runAiTool,
                })) {
                    if (ev.type === 'final') continue;
                    controller.enqueue(send(ev));
                }
            } catch (err) {
                controller.enqueue(send({ type: 'error', message: err instanceof Error ? err.message : 'erro' }));
            }
            controller.enqueue(send({ type: 'done' }));
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}
