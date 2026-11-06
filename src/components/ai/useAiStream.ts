'use client';

import { useCallback, useState } from 'react';

export type AiChatMessage = { role: 'user' | 'assistant'; content: string; tools?: string[] };

function appendToLastAssistant(msgs: AiChatMessage[], text: string): AiChatMessage[] {
    const next = [...msgs];
    const last = next[next.length - 1];
    if (last && last.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + text };
    return next;
}

function addToolToLast(msgs: AiChatMessage[], name: string): AiChatMessage[] {
    const next = [...msgs];
    const last = next[next.length - 1];
    if (last && last.role === 'assistant') next[next.length - 1] = { ...last, tools: [...(last.tools ?? []), name] };
    return next;
}

// Consome o SSE de POST /api/ai/chat, agregando os deltas na última mensagem
// 'assistant'. Sem persistência no servidor — o histórico da conversa vive só
// neste state; cada chamada reenvia as mensagens anteriores pra IA manter o
// contexto dentro da sessão aberta no navegador.
export function useAiStream() {
    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    const send = useCallback(async (message: string) => {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        setError(null);
        setStreaming(true);
        setMessages((prev) => [...prev, { role: 'user', content: message }, { role: 'assistant', content: '' }]);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history }),
            });
            if (!res.ok || !res.body) {
                // 503 = config faltando (ex.: DEEPSEEK_API_KEY) — a rota manda o
                // motivo no corpo; mostra ele pra pessoa saber o que resolver.
                const serverMsg = res.status === 503 ? await res.text().catch(() => '') : '';
                setError(serverMsg || (res.status === 503
                    ? 'Assistente indisponível neste ambiente.'
                    : 'Não foi possível falar com o assistente.'));
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const frames = buf.split('\n\n');
                buf = frames.pop() ?? '';
                for (const frame of frames) {
                    const line = frame.trim();
                    if (!line.startsWith('data:')) continue;
                    let ev: { type: string; text?: string; name?: string; message?: string };
                    try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
                    if (ev.type === 'delta' && ev.text) setMessages((prev) => appendToLastAssistant(prev, ev.text!));
                    else if (ev.type === 'tool' && ev.name) setMessages((prev) => addToolToLast(prev, ev.name!));
                    else if (ev.type === 'error') setError(ev.message ?? 'Erro no assistente.');
                }
            }
        } catch {
            setError('Não foi possível falar com o assistente.');
        } finally {
            setStreaming(false);
        }
    }, [messages]);

    return { messages, streaming, error, send, reset };
}
