'use client';

import { useState, useMemo } from 'react';
import { CXItem, CXStatus, CXCriticidade } from '@/types/manager';
import { ChevronUp, ChevronDown, ArrowUpDown, Search, X } from 'lucide-react';

interface CXTabProps {
    items: CXItem[];
}

const STATUS_CONFIG: Record<CXStatus, { label: string; style: string; chipStyle: string }> = {
    pendente: {
        label: 'Pendente',
        style: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        chipStyle: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
    },
    analise: {
        label: 'Em Análise',
        style: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        chipStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
    },
    resolvido: {
        label: 'Resolvido',
        style: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        chipStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    },
};

const CRITICIDADE_CONFIG: Record<CXCriticidade, { label: string; style: string; chipStyle: string }> = {
    baixa: {
        label: 'Baixa',
        style: 'bg-green-500/10 text-green-400 border border-green-500/20',
        chipStyle: 'bg-green-500/20 text-green-300 border-green-500/50',
    },
    media: {
        label: 'Média',
        style: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
        chipStyle: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
    },
    alta: {
        label: 'Alta',
        style: 'bg-red-500/10 text-red-400 border border-red-500/20',
        chipStyle: 'bg-red-500/20 text-red-300 border-red-500/50',
    },
};

const CRITICIDADE_WEIGHT: Record<CXCriticidade, number> = { baixa: 1, media: 2, alta: 3 };
const STATUS_WEIGHT: Record<CXStatus, number> = { pendente: 1, analise: 2, resolvido: 3 };

type SortKey = 'criticidade' | 'status' | null;
type SortDirection = 'asc' | 'desc';

const CRITICIDADES: CXCriticidade[] = ['alta', 'media', 'baixa'];
const STATUSES: CXStatus[] = ['pendente', 'analise', 'resolvido'];

export function CXTab({ items }: CXTabProps) {
    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [critFilter, setCritFilter] = useState<Set<CXCriticidade>>(new Set());
    const [statusFilter, setStatusFilter] = useState<Set<CXStatus>>(new Set());
    const [query, setQuery] = useState('');

    const toggle = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        setter(next);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('desc'); }
    };

    const visibleItems = items.filter(item => item.isVisible !== false);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return visibleItems.filter(item => {
            if (critFilter.size > 0 && !critFilter.has(item.criticidade || 'baixa')) return false;
            if (statusFilter.size > 0 && !statusFilter.has(item.status)) return false;
            if (q) {
                const hay = `${item.cliente} ${item.titulo ?? ''} ${item.problema} ${item.solucaoProposta}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [visibleItems, critFilter, statusFilter, query]);

    const sorted = useMemo(() => {
        if (!sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            let wA = 0, wB = 0;
            if (sortKey === 'criticidade') {
                wA = CRITICIDADE_WEIGHT[a.criticidade || 'baixa'];
                wB = CRITICIDADE_WEIGHT[b.criticidade || 'baixa'];
            } else if (sortKey === 'status') {
                wA = STATUS_WEIGHT[a.status];
                wB = STATUS_WEIGHT[b.status];
            }
            if (wA === wB) return 0;
            return sortDirection === 'asc' ? (wA > wB ? 1 : -1) : (wA < wB ? 1 : -1);
        });
    }, [filtered, sortKey, sortDirection]);

    const hasActiveFilter = critFilter.size > 0 || statusFilter.size > 0 || query.length > 0;
    const clearFilters = () => { setCritFilter(new Set()); setStatusFilter(new Set()); setQuery(''); };

    if (visibleItems.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 text-zinc-500">
                Nenhum registro de CX para este gerente.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Filtros */}
            <div className="flex flex-col gap-3 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative flex-1 min-w-[200px] w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar cliente, título, problema..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                        />
                    </div>
                    <div className="text-xs text-zinc-500 whitespace-nowrap">
                        Mostrando <span className="text-zinc-300 font-semibold">{sorted.length}</span> de {visibleItems.length}
                    </div>
                    {hasActiveFilter && (
                        <button
                            onClick={clearFilters}
                            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded-md hover:bg-zinc-800"
                        >
                            <X className="w-3 h-3" /> Limpar
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">Criticidade:</span>
                    {CRITICIDADES.map(c => {
                        const active = critFilter.has(c);
                        const cfg = CRITICIDADE_CONFIG[c];
                        return (
                            <button
                                key={c}
                                onClick={() => toggle(critFilter, c, setCritFilter)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${active ? cfg.chipStyle : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'}`}
                            >
                                {cfg.label}
                            </button>
                        );
                    })}

                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-1 ml-3">Status:</span>
                    {STATUSES.map(s => {
                        const active = statusFilter.has(s);
                        const cfg = STATUS_CONFIG[s];
                        return (
                            <button
                                key={s}
                                onClick={() => toggle(statusFilter, s, setStatusFilter)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${active ? cfg.chipStyle : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'}`}
                            >
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tabela */}
            {sorted.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-zinc-500 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800">
                    Nenhum registro corresponde aos filtros.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 text-left">
                                <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cliente / Órgão</th>
                                <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Problema</th>
                                <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Solução Proposta</th>
                                <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-28">
                                    <button onClick={() => handleSort('criticidade')} className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors focus:outline-none">
                                        CRITICIDADE
                                        {sortKey === 'criticidade' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                                    </button>
                                </th>
                                <th className="pb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-32">
                                    <button onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors focus:outline-none">
                                        STATUS
                                        {sortKey === 'status' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {sorted.map((item, i) => {
                                const status = STATUS_CONFIG[item.status];
                                return (
                                    <tr key={i} className="hover:bg-zinc-800/30 transition-colors align-top">
                                        <td className="py-3 pr-4 text-zinc-200 font-medium whitespace-nowrap">{item.cliente}</td>
                                        <td className="py-3 pr-4 max-w-xs">
                                            {item.titulo && <div className="text-zinc-300 font-semibold mb-1 text-sm">{item.titulo}</div>}
                                            <div className="text-zinc-400 text-xs">{item.problema}</div>
                                        </td>
                                        <td className="py-3 pr-4 text-zinc-400 max-w-xs">{item.solucaoProposta}</td>
                                        <td className="py-3 pr-4 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${CRITICIDADE_CONFIG[item.criticidade || 'baixa'].style}`}>
                                                {CRITICIDADE_CONFIG[item.criticidade || 'baixa'].label}
                                            </span>
                                        </td>
                                        <td className="py-3 text-center">
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${status.style}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
