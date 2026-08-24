'use client';

import { useState, useMemo } from 'react';
import { CXItem, CXStatus, CXCriticidade } from '@/types/manager';
import { ChevronUp, ChevronDown, ArrowUpDown, Search, X } from 'lucide-react';

interface CXTabProps {
    items: CXItem[];
    lightActive?: boolean;
}

const STATUS_CONFIG: Record<CXStatus, { label: string; style: string; chipStyle: string; styleLight: string; chipStyleLight: string }> = {
    pendente: {
        label: 'Pendente',
        style: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        chipStyle: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
        styleLight: 'bg-yellow-50 text-yellow-700 border border-yellow-300',
        chipStyleLight: 'bg-yellow-100 text-yellow-800 border-yellow-400',
    },
    analise: {
        label: 'Em Análise',
        style: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        chipStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
        styleLight: 'bg-blue-50 text-blue-700 border border-blue-300',
        chipStyleLight: 'bg-blue-100 text-blue-800 border-blue-400',
    },
    resolvido: {
        label: 'Resolvido',
        style: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        chipStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
        styleLight: 'bg-emerald-50 text-emerald-700 border border-emerald-300',
        chipStyleLight: 'bg-emerald-100 text-emerald-800 border-emerald-400',
    },
};

const CRITICIDADE_CONFIG: Record<CXCriticidade, { label: string; style: string; chipStyle: string; styleLight: string; chipStyleLight: string }> = {
    baixa: {
        label: 'Baixa',
        style: 'bg-green-500/10 text-green-400 border border-green-500/20',
        chipStyle: 'bg-green-500/20 text-green-300 border-green-500/50',
        styleLight: 'bg-green-50 text-green-700 border border-green-300',
        chipStyleLight: 'bg-green-100 text-green-800 border-green-400',
    },
    media: {
        label: 'Média',
        style: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
        chipStyle: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
        styleLight: 'bg-yellow-50 text-yellow-700 border border-yellow-300',
        chipStyleLight: 'bg-yellow-100 text-yellow-800 border-yellow-400',
    },
    alta: {
        label: 'Alta',
        style: 'bg-red-500/10 text-red-400 border border-red-500/20',
        chipStyle: 'bg-red-500/20 text-red-300 border-red-500/50',
        styleLight: 'bg-red-50 text-red-700 border border-red-300',
        chipStyleLight: 'bg-red-100 text-red-800 border-red-400',
    },
};

const CRITICIDADE_WEIGHT: Record<CXCriticidade, number> = { baixa: 1, media: 2, alta: 3 };
const STATUS_WEIGHT: Record<CXStatus, number> = { pendente: 1, analise: 2, resolvido: 3 };

type SortKey = 'criticidade' | 'status' | null;
type SortDirection = 'asc' | 'desc';

const CRITICIDADES: CXCriticidade[] = ['alta', 'media', 'baixa'];
const STATUSES: CXStatus[] = ['pendente', 'analise', 'resolvido'];

export function CXTab({ items, lightActive = false }: CXTabProps) {
    const T = {
        filterPanel: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-zinc-800',
        searchIcon: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        searchInput: lightActive ? 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400' : 'bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600',
        countText: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        countStrong: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        clearBtn: lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
        chipLabel: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        chipInactive: lightActive ? 'bg-white text-zinc-500 border-zinc-200 hover:text-zinc-700 hover:border-zinc-300' : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700',
        emptyState: lightActive ? 'text-zinc-400 bg-zinc-50 border-zinc-200' : 'text-zinc-500 bg-zinc-900/20 border-zinc-800',
        headBorder: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        headText: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        headHover: lightActive ? 'hover:text-zinc-700' : 'hover:text-zinc-300',
        rowDivide: lightActive ? 'divide-zinc-200' : 'divide-zinc-800/50',
        rowHover: lightActive ? 'hover:bg-zinc-50' : 'hover:bg-zinc-800/30',
        clientText: lightActive ? 'text-zinc-900' : 'text-zinc-200',
        tituloText: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        entryBorder: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        entryDate: lightActive ? 'text-indigo-600/90' : 'text-indigo-400/80',
        entryText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        verMais: lightActive ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-400 hover:text-indigo-300',
        solucaoText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        solucaoEmpty: lightActive ? 'text-zinc-300' : 'text-zinc-600',
    };
    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [critFilter, setCritFilter] = useState<Set<CXCriticidade>>(new Set());
    const [statusFilter, setStatusFilter] = useState<Set<CXStatus>>(new Set());
    const [query, setQuery] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<number | string>>(new Set());

    // Planner-imported CX logs are long, newline-separated update trails —
    // clamp them by default and let the user expand the ones worth reading
    // in full, instead of every row blowing up to its longest entry's height.
    const LONG_TEXT_THRESHOLD = 220;
    const isLongText = (text: string) => text.length > LONG_TEXT_THRESHOLD || text.split(/\r?\n/).length > 3;

    // Each log line usually starts with a date (sometimes + time), in a few
    // different formats the Planner export mixes: "27/07/2026 - texto",
    // "05.08.26 12:33 texto", "04/08/2026 14:47h - texto". Split the date off
    // so it can be styled distinctly from the update text and entries get
    // visual breathing room instead of running together.
    const LOG_DATE_RE = /^(\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s+\d{1,2}[:h]\d{2}h?)?)\s*-?\s*(.*)$/;
    type LogEntry = { date: string | null; text: string };
    const parseLogEntries = (raw: string): LogEntry[] =>
        raw
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean)
            .map(line => {
                const m = line.match(LOG_DATE_RE);
                return m ? { date: m[1], text: m[2] } : { date: null, text: line };
            });

    const toggle = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        setter(next);
    };

    const toggleExpanded = (key: number | string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
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

    // Planner não manda solução — a coluna só existe pra quem preenche isso
    // manualmente no Settings. Quando ninguém preencheu ainda pra este
    // gerente, esconde a coluna em vez de deixar um vão vazio enorme na
    // tabela, e devolve o espaço pra "Problema" (que é o que importa aqui).
    // Calculado sobre todos os itens visíveis (não só os filtrados), pra a
    // coluna não aparecer/sumir toda hora que alguém mexe nos filtros.
    const hasAnySolucao = useMemo(
        () => visibleItems.some(item => (item.solucaoProposta || '').trim().length > 0),
        [visibleItems]
    );

    const hasActiveFilter = critFilter.size > 0 || statusFilter.size > 0 || query.length > 0;
    const clearFilters = () => { setCritFilter(new Set()); setStatusFilter(new Set()); setQuery(''); };

    if (visibleItems.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                <div className={`flex items-center justify-center py-20 ${lightActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Nenhum registro de CX para este gerente.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Filtros */}
            <div className={`flex flex-col gap-3 p-3 rounded-xl border transition-colors duration-200 ${T.filterPanel}`}>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative flex-1 min-w-[200px] w-full">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${T.searchIcon}`} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar cliente, título, problema..."
                            className={`w-full border rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors duration-200 ${T.searchInput}`}
                        />
                    </div>
                    <div className={`text-xs whitespace-nowrap ${T.countText}`}>
                        Mostrando <span className={`font-semibold ${T.countStrong}`}>{sorted.length}</span> de {visibleItems.length}
                    </div>
                    {hasActiveFilter && (
                        <button
                            onClick={clearFilters}
                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${T.clearBtn}`}
                        >
                            <X className="w-3 h-3" /> Limpar
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider mr-1 ${T.chipLabel}`}>Criticidade:</span>
                    {CRITICIDADES.map(c => {
                        const active = critFilter.has(c);
                        const cfg = CRITICIDADE_CONFIG[c];
                        return (
                            <button
                                key={c}
                                onClick={() => toggle(critFilter, c, setCritFilter)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${active ? (lightActive ? cfg.chipStyleLight : cfg.chipStyle) : T.chipInactive}`}
                            >
                                {cfg.label}
                            </button>
                        );
                    })}

                    <span className={`text-[10px] font-semibold uppercase tracking-wider mr-1 ml-3 ${T.chipLabel}`}>Status:</span>
                    {STATUSES.map(s => {
                        const active = statusFilter.has(s);
                        const cfg = STATUS_CONFIG[s];
                        return (
                            <button
                                key={s}
                                onClick={() => toggle(statusFilter, s, setStatusFilter)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${active ? (lightActive ? cfg.chipStyleLight : cfg.chipStyle) : T.chipInactive}`}
                            >
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tabela */}
            {sorted.length === 0 ? (
                <div className={`flex items-center justify-center py-16 rounded-xl border border-dashed transition-colors duration-200 ${T.emptyState}`}>
                    Nenhum registro corresponde aos filtros.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                        <thead>
                            <tr className={`border-b text-left ${T.headBorder}`}>
                                <th className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-wider w-40 ${T.headText}`}>Cliente / Órgão</th>
                                <th className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-wider ${T.headText} ${hasAnySolucao ? 'w-[34%]' : 'w-[58%]'}`}>Problema</th>
                                {hasAnySolucao && (
                                    <th className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-wider w-[26%] ${T.headText}`}>Solução Proposta</th>
                                )}
                                <th className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-center w-32 ${T.headText}`}>
                                    <button onClick={() => handleSort('criticidade')} className={`inline-flex items-center gap-1 transition-colors focus:outline-none ${T.headHover}`}>
                                        CRITICIDADE
                                        {sortKey === 'criticidade' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                                    </button>
                                </th>
                                <th className={`pb-3 text-xs font-semibold uppercase tracking-wider text-center w-36 ${T.headText}`}>
                                    <button onClick={() => handleSort('status')} className={`inline-flex items-center gap-1 transition-colors focus:outline-none ${T.headHover}`}>
                                        STATUS
                                        {sortKey === 'status' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${T.rowDivide}`}>
                            {sorted.map((item, i) => {
                                const status = STATUS_CONFIG[item.status];
                                const rowKey = item.id ?? i;
                                const entries = parseLogEntries(item.problema);
                                const isExpanded = expandedRows.has(rowKey);
                                const visibleEntries = isExpanded || entries.length <= 2 ? entries : entries.slice(0, 2);
                                const hiddenCount = entries.length - visibleEntries.length;
                                const solucaoLong = isLongText(item.solucaoProposta || '');
                                const expandable = entries.length > 2 || isLongText(item.problema) || solucaoLong;
                                const clampSolucao = solucaoLong && !isExpanded ? 'line-clamp-3' : '';
                                return (
                                    <tr
                                        key={rowKey}
                                        onClick={() => { if (expandable) toggleExpanded(rowKey); }}
                                        className={`transition-colors align-top ${T.rowHover} ${expandable ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className={`py-3 pr-4 font-medium truncate ${T.clientText}`}>{item.cliente}</td>
                                        <td className="py-3 pr-4">
                                            {item.titulo && <div className={`font-semibold mb-1 text-sm ${T.tituloText}`}>{item.titulo}</div>}
                                            <div className="space-y-2.5">
                                                {visibleEntries.map((entry, idx) => (
                                                    <div key={idx} className={`border-l-2 pl-2 flex flex-col gap-0.5 ${T.entryBorder}`}>
                                                        {entry.date && (
                                                            <span className={`text-[10px] font-mono font-semibold tracking-wide whitespace-nowrap ${T.entryDate}`}>
                                                                {entry.date}
                                                            </span>
                                                        )}
                                                        <span className={`text-xs break-words ${T.entryText} ${!isExpanded ? 'line-clamp-3' : ''}`}>
                                                            {entry.text}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {expandable && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleExpanded(rowKey); }}
                                                    className={`mt-2 text-[11px] font-semibold focus:outline-none ${T.verMais}`}
                                                >
                                                    {isExpanded ? 'Ver menos' : hiddenCount > 0 ? `Ver mais (+${hiddenCount} atualizaç${hiddenCount === 1 ? 'ão' : 'ões'})` : 'Ver mais'}
                                                </button>
                                            )}
                                        </td>
                                        {hasAnySolucao && (
                                            <td className="py-3 pr-4">
                                                {item.solucaoProposta ? (
                                                    <div className={`text-xs whitespace-pre-line break-words ${T.solucaoText} ${clampSolucao}`}>{item.solucaoProposta}</div>
                                                ) : (
                                                    <span className={`text-xs italic ${T.solucaoEmpty}`}>—</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="py-3 pr-4 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${lightActive ? CRITICIDADE_CONFIG[item.criticidade || 'baixa'].styleLight : CRITICIDADE_CONFIG[item.criticidade || 'baixa'].style}`}>
                                                {CRITICIDADE_CONFIG[item.criticidade || 'baixa'].label}
                                            </span>
                                        </td>
                                        <td className="py-3 text-center">
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${lightActive ? status.styleLight : status.style}`}>
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
