'use client';

import { useState } from 'react';
import { CAMPOS_DESTAQUE, type EventoHistorico } from '@/lib/grcc/tipos';
import { dataHoraBr, deParaMudanca, rotuloMudanca } from './formato';

const ORIGEM: Record<EventoHistorico['origem'], string> = {
    cadastro: 'Cadastrado',
    edicao: 'Editado na tela',
    importacao: 'Importação',
    exclusao: 'Excluído',
};

function Evento({ ev, claro }: { ev: EventoHistorico; claro: boolean }) {
    const [verTudo, setVerTudo] = useState(false);
    const destaque = ev.mudancas.filter((m) => CAMPOS_DESTAQUE.includes(m.campo));
    const texto = ev.mudancas.filter((m) => m.campo === 'valor' || m.campo === 'previsaoFechamento');
    const resto = ev.mudancas.filter((m) => !destaque.includes(m) && !texto.includes(m));
    const fraco = 'text-zinc-500';
    const forte = claro ? 'text-zinc-900' : 'text-zinc-100';

    return (
        <li className="relative pl-5">
            <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <p className={`text-xs ${fraco}`}>
                {dataHoraBr(ev.quando)} · {ev.autor} · {ORIGEM[ev.origem]}
                {ev.arquivo && ` (${ev.arquivo})`}
            </p>
            {ev.origem === 'cadastro' || (ev.origem === 'importacao' && ev.mudancas.every((m) => m.de === null)) ? (
                <p className={`text-sm ${forte}`}>Lead cadastrado</p>
            ) : (
                <div className="flex flex-col gap-1 mt-1">
                    {destaque.map((m) => {
                        const d = deParaMudanca(m);
                        return (
                            <p key={m.campo} className="text-sm flex flex-wrap items-center gap-1.5">
                                <span className={fraco}>{d.rotulo}:</span>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/30 line-through opacity-70">{d.de}</span>
                                <span className={fraco}>→</span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-semibold">{d.para}</span>
                            </p>
                        );
                    })}
                    {texto.map((m) => (
                        <p key={m.campo} className={`text-sm ${forte}`}>{rotuloMudanca(m)}</p>
                    ))}
                    {resto.length > 0 &&
                        (verTudo ? (
                            resto.map((m) => (
                                <p key={m.campo} className={`text-xs ${fraco}`}>{rotuloMudanca(m)}</p>
                            ))
                        ) : (
                            <button type="button" onClick={() => setVerTudo(true)} className="text-xs text-indigo-400 text-left">
                                +{resto.length} alteração(ões)
                            </button>
                        ))}
                </div>
            )}
        </li>
    );
}

export function LeadHistorico({ eventos, claro = false }: { eventos: EventoHistorico[]; claro?: boolean }) {
    if (eventos.length === 0) return <p className="text-sm text-zinc-500">Sem histórico ainda.</p>;
    return (
        <ol className="flex flex-col gap-4 border-l border-zinc-800 ml-1">
            {eventos.map((ev) => (
                <Evento key={ev.id} ev={ev} claro={claro} />
            ))}
        </ol>
    );
}
