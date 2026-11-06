'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus, X, ArrowUp, Loader2, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { THEME_STORAGE_KEY, THEME_CHANGE_EVENT } from '@/lib/themeSync';
import { useAiStream } from './useAiStream';
import { Markdown } from './Markdown';

const SUGESTOES = [
    'Como está o atingimento da DRM?',
    'Quais bloqueios estão travados por área externa?',
    'Contratos vencendo nos próximos 90 dias',
    'Resumo das propostas em aberto',
];

export function AiChatWidget() {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [lightActive, setLightActive] = useState(() => {
        try { return typeof window !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY) === 'light'; } catch { return false; }
    });
    const bottomRef = useRef<HTMLDivElement>(null);
    const taRef = useRef<HTMLTextAreaElement>(null);
    const { messages, streaming, error, send, reset } = useAiStream();

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
    }, [messages]);

    useEffect(() => {
        const el = taRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [draft]);

    // Sync de tema — o widget vive no layout raiz, fora das telas com o alternador.
    useEffect(() => {
        const readTheme = () => {
            try { return localStorage.getItem(THEME_STORAGE_KEY) === 'light'; } catch { return false; }
        };
        const onThemeChange = (e: Event) => {
            const detail = (e as CustomEvent<'dark' | 'light'>).detail;
            queueMicrotask(() => setLightActive(detail ? detail === 'light' : readTheme()));
        };
        const onStorage = (e: StorageEvent) => {
            if (e.key !== THEME_STORAGE_KEY) return;
            queueMicrotask(() => setLightActive(e.newValue === 'light'));
        };
        window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const novaConversa = useCallback(() => { reset(); setDraft(''); }, [reset]);

    const enviar = async (texto?: string) => {
        const text = (texto ?? draft).trim();
        if (!text || streaming) return;
        setDraft('');
        await send(text);
    };

    const T = {
        panel: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100',
        border: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        muted: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        faint: lightActive ? 'text-zinc-400' : 'text-zinc-600',
        aiBand: lightActive ? 'bg-zinc-50' : 'bg-zinc-900/40',
        composer: lightActive ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-700',
        chip: lightActive
            ? 'border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-zinc-700'
            : 'border-zinc-800 hover:border-indigo-800 hover:bg-indigo-950/20 text-zinc-300',
        ta: lightActive ? 'text-zinc-900 placeholder:text-zinc-400' : 'text-zinc-100 placeholder:text-zinc-600',
    };

    const empty = messages.length === 0;

    // Avatar do AIBertinho — o mesmo mascote usado no header/login.
    const avatar = (size: string, extra = '') => (
        <Image src="/avatars/aibertinho.png" alt="AIBertinho" width={56} height={56}
            className={`${size} rounded-full object-cover shrink-0 ${extra}`} />
    );

    return (
        <>
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Assistente de IA"
                className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-lg shadow-indigo-950/40 flex items-center justify-center transition-transform hover:scale-105 overflow-hidden ring-2 ring-indigo-500"
            >
                {open ? (
                    <span className="w-full h-full bg-indigo-600 text-white flex items-center justify-center"><X className="w-6 h-6" /></span>
                ) : (
                    <Image src="/avatars/aibertinho.png" alt="AIBertinho" width={56} height={56} className="w-full h-full object-cover" priority />
                )}
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    showCloseButton={false}
                    className={`z-50 flex flex-col gap-0 p-0 overflow-hidden
                        top-0 left-0 translate-x-0 translate-y-0 w-full h-full max-w-full rounded-none
                        md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] md:max-w-none md:rounded-2xl
                        md:w-[min(560px,94vw)] md:h-[min(720px,90vh)] ${T.panel}`}
                >
                    <DialogTitle className="sr-only">Assistente de IA</DialogTitle>
                    <DialogDescription className="sr-only">Converse com o AIBertinho sobre os dados da DRM.</DialogDescription>

                    <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${T.border}`}>
                        <span className="text-sm font-semibold flex items-center gap-1.5 truncate min-w-0">
                            {avatar('w-5 h-5')} AIBertinho
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={novaConversa} aria-label="Nova conversa" className={`${T.muted} p-1`}>
                                <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => setOpen(false)} aria-label="Fechar" className={`${T.muted} p-1`}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {empty ? (
                                <div className="h-full flex flex-col items-center justify-center gap-5 px-6 text-center">
                                    {avatar('w-16 h-16', 'ring-2 ring-indigo-500/40')}
                                    <div>
                                        <p className="text-base font-semibold">Pergunte sobre a DRM</p>
                                        <p className={`text-xs mt-1 ${T.muted}`}>
                                            Atingimento, contratos, propostas, bloqueios de CX, visitas — o AIBertinho consulta os dados atuais.
                                        </p>
                                    </div>
                                    <div className="w-full flex flex-col gap-2">
                                        {SUGESTOES.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => enviar(s)}
                                                className={`text-left text-[13px] rounded-xl border px-3 py-2.5 transition-colors ${T.chip}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {messages.map((m, i) => {
                                        const isAi = m.role === 'assistant';
                                        return (
                                            <div key={i} className={`px-4 py-3.5 ${isAi ? T.aiBand : ''}`}>
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    {isAi
                                                        ? avatar('w-5 h-5')
                                                        : <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${lightActive ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-800 text-zinc-300'}`}>V</span>}
                                                    <span className={`text-[11px] font-semibold ${T.muted}`}>{isAi ? 'AIBertinho' : 'Você'}</span>
                                                </div>
                                                {m.tools && m.tools.length > 0 && (
                                                    <div className={`flex flex-wrap gap-1 mb-1.5 text-[10px] ${T.faint}`}>
                                                        {m.tools.map((t, ti) => (
                                                            <span key={ti} className="inline-flex items-center gap-1"><Wrench className="w-3 h-3" />{t}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {isAi ? (
                                                    m.content
                                                        ? <Markdown lightActive={lightActive}>{m.content}</Markdown>
                                                        : (streaming && i === messages.length - 1
                                                            ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                                            : null)
                                                ) : (
                                                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {error && <p className="text-[12px] text-red-500 px-4 py-2">{error}</p>}
                                    <div ref={bottomRef} />
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 px-3 pb-3 pt-2">
                            <div className={`flex items-end gap-2 rounded-2xl border px-3 py-2 ${T.composer}`}>
                                <textarea
                                    ref={taRef}
                                    rows={1}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                            e.preventDefault();
                                            enviar();
                                        }
                                    }}
                                    placeholder="Pergunte alguma coisa..."
                                    className={`flex-1 min-w-0 bg-transparent text-sm resize-none leading-relaxed max-h-[160px] overflow-y-auto focus:outline-none py-1 ${T.ta}`}
                                />
                                <button
                                    onClick={() => enviar()}
                                    disabled={streaming || !draft.trim()}
                                    aria-label="Enviar"
                                    className="w-8 h-8 shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center disabled:opacity-30 transition-colors"
                                >
                                    {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className={`text-[10px] text-center mt-1.5 ${T.faint}`}>O AIBertinho só consulta dados — não altera nada.</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
