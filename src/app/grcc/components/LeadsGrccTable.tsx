'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { CATEGORIAS_GRCC, type CategoriaGrcc, type LeadGrcc } from '@/lib/grcc/tipos';
import { pendenciasDoLead } from '@/lib/grcc/validacao';
import { temperaturaDaCategoria } from '@/lib/grcc/pipeline';
import { chaveTexto } from '@/lib/grcc/normalizar';
import { brl, COR_CATEGORIA, dataBr, haQuanto } from './formato';

type Filtro = 'todos' | 'pendencias' | CategoriaGrcc;

export function LeadsGrccTable({
    leads,
    onAbrir,
    destacados = new Set<number>(),
}: {
    leads: LeadGrcc[];
    onAbrir: (id: number) => void;
    destacados?: Set<number>;
}) {
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [busca, setBusca] = useState('');

    const pend = useMemo(() => new Map(leads.map((l) => [l.id, pendenciasDoLead(l)])), [leads]);
    const contagem = useMemo(() => {
        const c = new Map<Filtro, number>([['todos', leads.length], ['pendencias', 0]]);
        for (const l of leads) {
            c.set(l.categoria, (c.get(l.categoria) ?? 0) + 1);
            if ((pend.get(l.id) ?? []).length > 0) c.set('pendencias', (c.get('pendencias') ?? 0) + 1);
        }
        return c;
    }, [leads, pend]);

    const visiveis = useMemo(() => {
        const alvo = chaveTexto(busca);
        return leads.filter((l) => {
            if (filtro === 'pendencias' && (pend.get(l.id) ?? []).length === 0) return false;
            if (filtro !== 'todos' && filtro !== 'pendencias' && l.categoria !== filtro) return false;
            if (!alvo) return true;
            return chaveTexto(`${l.cliente} ${l.solicitacao} ${l.municipio ?? ''}`).includes(alvo);
        });
    }, [leads, filtro, busca, pend]);

    const chip = (f: Filtro, rotulo: string) => {
        const n = contagem.get(f) ?? 0;
        if (f !== 'todos' && f !== 'pendencias' && n === 0) return null;
        const ativo = filtro === f;
        return (
            <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    ativo ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-100'
                }`}
            >
                {f === 'pendencias' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                {rotulo} {n}
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {chip('todos', 'Todos')}
                {CATEGORIAS_GRCC.map((c) => chip(c, c))}
                {chip('pendencias', 'Pendências')}
                <label className="ml-auto flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 h-9 w-full sm:w-72">
                    <Search className="w-4 h-4 text-zinc-500" />
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar cliente, solicitação ou município"
                        className="bg-transparent outline-none text-sm text-zinc-200 w-full"
                    />
                </label>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-950 text-zinc-400 text-[11px] uppercase tracking-wider">
                        <tr>
                            <th className="text-left px-4 py-3">Cliente</th>
                            <th className="text-left px-4 py-3">Solicitação</th>
                            <th className="text-left px-4 py-3">Categoria</th>
                            <th className="text-left px-4 py-3">Etapa</th>
                            <th className="text-right px-4 py-3">Valor</th>
                            <th className="text-left px-4 py-3">Previsão</th>
                            <th className="text-left px-4 py-3">Atualizado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {visiveis.map((l) => {
                            const p = pend.get(l.id) ?? [];
                            return (
                                <tr
                                    key={l.id}
                                    onClick={() => onAbrir(l.id)}
                                    className={`cursor-pointer hover:bg-zinc-900/60 transition-colors ${destacados.has(l.id) ? 'bg-indigo-500/10' : ''}`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                                            {p.length > 0 && (
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label={p.join(', ')} />
                                            )}
                                            {l.cliente}
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {l.municipio ?? 'Sem município'} · {l.uf ?? '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-300 max-w-[260px] truncate">{l.solicitacao || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${COR_CATEGORIA[l.categoria]}`} title={`No pipeline: ${temperaturaDaCategoria(l.categoria)}`}>
                                            {l.categoria}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-400">{l.etapa ?? '—'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-zinc-200">{l.valor ? brl(l.valor) : '—'}</td>
                                    <td className="px-4 py-3 text-zinc-400">{dataBr(l.previsaoFechamento)}</td>
                                    <td className="px-4 py-3 text-zinc-500 text-xs">{haQuanto(l.atualizadoEm)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {visiveis.length === 0 && <p className="text-center text-sm text-zinc-500 py-10">Nenhum lead neste filtro.</p>}
            </div>
        </div>
    );
}
