'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, MapPin, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { brl, corCategoria, dataBr } from '@/app/grcc/components/formato';
import { CATEGORIAS_GRCC, type CategoriaGrcc } from '@/lib/grcc/tipos';
import { chaveTexto } from '@/lib/grcc/normalizar';
import { chaveCidade, somaValor } from '@/lib/cidades/indicadores';
import type { LeadCidade } from '@/types/cidades';

export interface DetalheIndicador {
    titulo: string;
    descricao: string;
    leads: LeadCidade[];
    /** Agrupa a lista por município (card "Cidades atendidas"). */
    porCidade?: boolean;
}

function categoriaGrcc(c: string): CategoriaGrcc | null {
    return (CATEGORIAS_GRCC as readonly string[]).includes(c) ? (c as CategoriaGrcc) : null;
}

/** Lista dos leads que formam um número do dashboard. Clicar num lead abre o detalhe dele. */
export function IndicadorModal({
    detalhe,
    aberto,
    onFechar,
    onAbrirLead,
    claro,
}: {
    detalhe: DetalheIndicador | null;
    aberto: boolean;
    onFechar: () => void;
    onAbrirLead: (id: number) => void;
    claro: boolean;
}) {
    const [busca, setBusca] = useState('');
    const [origem, setOrigem] = useState(detalhe?.titulo ?? null);
    // Zera a busca ao trocar de indicador (ajuste de estado durante a renderização).
    if (origem !== (detalhe?.titulo ?? null)) {
        setOrigem(detalhe?.titulo ?? null);
        setBusca('');
    }

    const visiveis = useMemo(() => {
        if (!detalhe) return [];
        const alvo = chaveTexto(busca);
        if (!alvo) return detalhe.leads;
        return detalhe.leads.filter((l) => chaveTexto(`${l.cliente} ${l.solicitacao} ${l.municipio} ${l.uf} ${l.categoria}`).includes(alvo));
    }, [detalhe, busca]);

    const grupos = useMemo(() => {
        if (!detalhe?.porCidade) return null;
        const m = new Map<string, { rotulo: string; leads: LeadCidade[] }>();
        for (const l of visiveis) {
            const k = chaveCidade(l);
            const g = m.get(k) ?? { rotulo: `${l.municipio.trim()} · ${l.uf || '—'}`, leads: [] };
            g.leads.push(l);
            m.set(k, g);
        }
        return [...m.values()];
    }, [detalhe, visiveis]);

    const t = {
        forte: claro ? 'text-zinc-900' : 'text-zinc-100',
        medio: claro ? 'text-zinc-700' : 'text-zinc-300',
        fraco: claro ? 'text-zinc-500' : 'text-zinc-400',
        borda: claro ? 'border-zinc-200' : 'border-zinc-800',
        linha: claro ? 'hover:bg-zinc-50' : 'hover:bg-zinc-900/70',
        grupo: claro ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-900 text-zinc-300',
        campo: claro ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100',
    };
    const cores = corCategoria(claro);

    const linha = (l: LeadCidade) => {
        const cat = categoriaGrcc(l.categoria);
        return (
            <li key={l.id}>
                <button type="button" onClick={() => onAbrirLead(l.id)} className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${t.linha}`}>
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${t.forte}`}>{l.cliente}</p>
                        <p className={`text-xs truncate ${t.fraco}`}>{l.solicitacao || l.status || '—'}</p>
                        <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${t.fraco}`}>
                            <MapPin className="w-3 h-3" /> {[l.municipio, l.uf].filter(Boolean).join(' · ') || 'Sem local'}
                            {l.previsao_fechamento && <span>· previsão {dataBr(l.previsao_fechamento)}</span>}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`font-mono text-sm font-bold ${l.valor ? (claro ? 'text-emerald-600' : 'text-emerald-400') : t.fraco}`}>
                            {l.valor ? brl(l.valor) : 'Valor a definir'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cat ? cores[cat] : t.borda}`}>{l.categoria || '—'}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${t.fraco}`} />
                </button>
            </li>
        );
    };

    return (
        <Dialog open={aberto && !!detalhe} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className={`sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 ${claro ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'}`}>
                {detalhe && (
                    <>
                        <DialogHeader className={`px-6 pt-6 pb-4 text-left border-b ${t.borda}`}>
                            <DialogTitle className={`pr-6 ${t.forte}`}>{detalhe.titulo}</DialogTitle>
                            <DialogDescription className={t.fraco}>{detalhe.descricao}</DialogDescription>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
                                <span className={t.medio}>
                                    <strong className={t.forte}>{detalhe.leads.length}</strong> {detalhe.leads.length === 1 ? 'lead' : 'leads'}
                                </span>
                                <span className={t.medio}>
                                    Soma: <strong className={claro ? 'text-emerald-600' : 'text-emerald-400'}>{brl(somaValor(detalhe.leads))}</strong>
                                </span>
                                {detalhe.leads.some((l) => !l.valor) && (
                                    <span className={`text-xs ${t.fraco}`}>{detalhe.leads.filter((l) => !l.valor).length} sem valor definido</span>
                                )}
                            </div>
                            {detalhe.leads.length > 6 && (
                                <label className={`mt-2 flex items-center gap-2 rounded-lg border px-3 h-9 ${t.campo}`}>
                                    <Search className={`w-4 h-4 ${t.fraco}`} />
                                    <input
                                        value={busca}
                                        onChange={(e) => setBusca(e.target.value)}
                                        placeholder="Filtrar por cliente, município ou categoria"
                                        aria-label="Filtrar leads"
                                        className="bg-transparent outline-none text-sm w-full"
                                    />
                                </label>
                            )}
                        </DialogHeader>
                        <div className="overflow-y-auto">
                            {visiveis.length === 0 ? (
                                <p className={`text-center text-sm py-10 ${t.fraco}`}>Nenhum lead {busca ? 'neste filtro' : 'neste indicador'}.</p>
                            ) : grupos ? (
                                grupos.map((g) => (
                                    <section key={g.rotulo}>
                                        <h4 className={`px-4 py-1.5 text-xs font-semibold flex justify-between ${t.grupo}`}>
                                            <span>{g.rotulo}</span>
                                            <span>
                                                {g.leads.length} · {brl(somaValor(g.leads))}
                                            </span>
                                        </h4>
                                        <ul className={`divide-y ${claro ? 'divide-zinc-100' : 'divide-zinc-800/60'}`}>{g.leads.map(linha)}</ul>
                                    </section>
                                ))
                            ) : (
                                <ul className={`divide-y ${claro ? 'divide-zinc-100' : 'divide-zinc-800/60'}`}>{visiveis.map(linha)}</ul>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
