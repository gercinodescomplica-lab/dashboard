'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { CAMPOS_DESTAQUE, type EventoHistorico } from '@/lib/grcc/tipos';
import { dataHoraBr, deParaMudanca, rotuloMudanca } from './formato';

const ORIGEM: Record<EventoHistorico['origem'], string> = {
    cadastro: 'Cadastrado',
    edicao: 'Editado na tela',
    importacao: 'Importação',
    exclusao: 'Excluído',
    correcao: 'Correção de andamento',
    remocao: 'Andamento removido',
};

function Evento({ ev, claro, onEditarAndamento }: { ev: EventoHistorico; claro: boolean; onEditarAndamento?: () => void }) {
    const [verTudo, setVerTudo] = useState(false);
    const destaque = ev.mudancas.filter((m) => CAMPOS_DESTAQUE.includes(m.campo));
    const texto = ev.mudancas.filter((m) => m.campo === 'status' || m.campo === 'valor' || m.campo === 'previsaoFechamento');
    const resto = ev.mudancas.filter((m) => !destaque.includes(m) && !texto.includes(m));
    const fraco = 'text-zinc-500';
    const forte = claro ? 'text-zinc-900' : 'text-zinc-100';

    return (
        <li className="relative pl-5">
            <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <div className="flex items-center justify-between gap-2">
                <p className={`text-xs ${fraco}`}>
                    {dataHoraBr(ev.quando)} · {ev.autor} · {ORIGEM[ev.origem]}
                    {ev.arquivo && ` (${ev.arquivo})`}
                </p>
                {onEditarAndamento && (
                    <button
                        type="button"
                        onClick={onEditarAndamento}
                        className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${claro ? 'text-indigo-600 hover:bg-indigo-50' : 'text-indigo-400 hover:bg-indigo-500/10'}`}
                    >
                        <Pencil className="w-3 h-3" /> Editar andamento
                    </button>
                )}
            </div>
            {ev.origem === 'correcao' || ev.origem === 'remocao' ? (
                <p className="text-sm flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={fraco}>{ev.origem === 'correcao' ? 'Andamento corrigido:' : 'Removido da linha do tempo:'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/30 line-through opacity-70">{String(ev.mudancas[0]?.de ?? '—')}</span>
                    {ev.origem === 'correcao' && (
                        <>
                            <span className={fraco}>→</span>
                            <span className={`px-1.5 py-0.5 rounded border font-semibold ${claro ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'}`}>
                                {String(ev.mudancas[0]?.para ?? '—')}
                            </span>
                        </>
                    )}
                </p>
            ) : ev.origem === 'cadastro' || (ev.origem === 'importacao' && ev.mudancas.every((m) => m.de === null)) ? (
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
                        <p key={m.campo} className={`text-sm ${forte}`}>
                            {m.campo === 'status' ? `Andamento: ${m.para ?? '—'}` : rotuloMudanca(m)}
                        </p>
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

export function LeadHistorico({
    eventos,
    claro = false,
    andamentosAtivos,
    onEditarAndamento,
}: {
    eventos: EventoHistorico[];
    claro?: boolean;
    /** Ids dos eventos cujo andamento ainda está na linha do tempo (ganham o botão "Editar andamento"). */
    andamentosAtivos?: Set<number>;
    onEditarAndamento?: (eventoId: number) => void;
}) {
    if (eventos.length === 0) return <p className="text-sm text-zinc-500">Sem histórico ainda.</p>;
    return (
        <ol className="flex flex-col gap-4 border-l border-zinc-800 ml-1">
            {eventos.map((ev) => (
                <Evento
                    key={ev.id}
                    ev={ev}
                    claro={claro}
                    onEditarAndamento={onEditarAndamento && andamentosAtivos?.has(ev.id) ? () => onEditarAndamento(ev.id) : undefined}
                />
            ))}
        </ol>
    );
}
