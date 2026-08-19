'use client';

import { useState, useMemo, useRef } from 'react';
import { CXItem, CXStatus, CXCriticidade } from '@/types/manager';
import { ChevronUp, ChevronDown, ArrowUpDown, Search, X, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadPlannerTasks } from '@/services/planner-upload.service';

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
type UploadState = 'idle' | 'uploading' | 'done' | 'error';

const CRITICIDADES: CXCriticidade[] = ['alta', 'media', 'baixa'];
const STATUSES: CXStatus[] = ['pendente', 'analise', 'resolvido'];

// Aceita tanto um array cru de tarefas quanto { tasks: [...] } — mesmo
// formato flexível que os endpoints /planner-sync já aceitam.
function extractTasksArray(parsed: unknown, filename: string): unknown[] {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks)) {
        return (parsed as { tasks: unknown[] }).tasks;
    }
    throw new Error(`"${filename}" não é uma lista de tarefas nem um objeto { tasks: [...] }.`);
}

export function CXTab({ items }: CXTabProps) {
    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [critFilter, setCritFilter] = useState<Set<CXCriticidade>>(new Set());
    const [statusFilter, setStatusFilter] = useState<Set<CXStatus>>(new Set());
    const [query, setQuery] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<number | string>>(new Set());

    // ── Upload manual do JSON do Planner ────────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadState('uploading');
        setUploadMessage(null);

        try {
            const allTasks: unknown[] = [];
            for (const file of Array.from(files)) {
                const text = await file.text();
                let parsed: unknown;
                try {
                    parsed = JSON.parse(text);
                } catch {
                    throw new Error(`"${file.name}" não é um JSON válido.`);
                }
                allTasks.push(...extractTasksArray(parsed, file.name));
            }

            if (allTasks.length === 0) {
                throw new Error('Nenhuma tarefa encontrada no(s) arquivo(s) selecionado(s).');
            }

            const result = await uploadPlannerTasks({ tasks: allTasks });
            if (!result.success) {
                setUploadState('error');
                setUploadMessage(result.error);
                return;
            }

            const s = result.summary;
            setUploadState('done');
            setUploadMessage(
                `${s.total} tarefa${s.total === 1 ? '' : 's'} processada${s.total === 1 ? '' : 's'} — ` +
                `${s.created} criada${s.created === 1 ? '' : 's'}, ${s.updated} atualizada${s.updated === 1 ? '' : 's'}` +
                (s.unmatched.length > 0 ? `, ${s.unmatched.length} sem gerente` : '') +
                '. Atualizando a página...'
            );
            setTimeout(() => window.location.reload(), 1800);
        } catch (err) {
            setUploadState('error');
            setUploadMessage(err instanceof Error ? err.message : 'Erro inesperado ao processar o upload.');
        } finally {
            // Permite selecionar o(s) mesmo(s) arquivo(s) de novo depois.
            e.target.value = '';
        }
    };

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

    const uploadButton = (
        <>
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === 'uploading'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Envia o(s) JSON exportado(s) do Planner e sincroniza o CX de todos os gerentes"
            >
                {uploadState === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload Planner
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />
        </>
    );

    const uploadBanner = uploadState !== 'idle' && (
        <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${uploadState === 'uploading'
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : uploadState === 'done'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-300 border-red-500/30'
                }`}
        >
            {uploadState === 'uploading' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
            {uploadState === 'done' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
            {uploadState === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
            <span>{uploadState === 'uploading' ? 'Processando arquivo(s)...' : uploadMessage}</span>
            {uploadState === 'done' && (
                <button onClick={() => window.location.reload()} className="ml-auto underline hover:no-underline shrink-0">
                    Atualizar agora
                </button>
            )}
            {uploadState === 'error' && (
                <button onClick={() => setUploadState('idle')} className="ml-auto underline hover:no-underline shrink-0">
                    Fechar
                </button>
            )}
        </div>
    );

    if (visibleItems.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-end gap-3">{uploadButton}</div>
                {uploadBanner}
                <div className="flex items-center justify-center py-20 text-zinc-500">
                    Nenhum registro de CX para este gerente.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {uploadBanner}

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
                    {uploadButton}
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
                    <table className="w-full text-sm table-fixed">
                        <thead>
                            <tr className="border-b border-zinc-800 text-left">
                                <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-40">Cliente / Órgão</th>
                                <th className={`pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider ${hasAnySolucao ? 'w-[34%]' : 'w-[58%]'}`}>Problema</th>
                                {hasAnySolucao && (
                                    <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-[26%]">Solução Proposta</th>
                                )}
                                <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-32">
                                    <button onClick={() => handleSort('criticidade')} className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors focus:outline-none">
                                        CRITICIDADE
                                        {sortKey === 'criticidade' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                                    </button>
                                </th>
                                <th className="pb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-36">
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
                                        className={`hover:bg-zinc-800/30 transition-colors align-top ${expandable ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className="py-3 pr-4 text-zinc-200 font-medium truncate">{item.cliente}</td>
                                        <td className="py-3 pr-4">
                                            {item.titulo && <div className="text-zinc-300 font-semibold mb-1 text-sm">{item.titulo}</div>}
                                            <div className="space-y-2.5">
                                                {visibleEntries.map((entry, idx) => (
                                                    <div key={idx} className="border-l-2 border-zinc-800 pl-2 flex flex-col gap-0.5">
                                                        {entry.date && (
                                                            <span className="text-[10px] font-mono font-semibold text-indigo-400/80 tracking-wide whitespace-nowrap">
                                                                {entry.date}
                                                            </span>
                                                        )}
                                                        <span className={`text-zinc-400 text-xs break-words ${!isExpanded ? 'line-clamp-3' : ''}`}>
                                                            {entry.text}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {expandable && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleExpanded(rowKey); }}
                                                    className="mt-2 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 focus:outline-none"
                                                >
                                                    {isExpanded ? 'Ver menos' : hiddenCount > 0 ? `Ver mais (+${hiddenCount} atualizaç${hiddenCount === 1 ? 'ão' : 'ões'})` : 'Ver mais'}
                                                </button>
                                            )}
                                        </td>
                                        {hasAnySolucao && (
                                            <td className="py-3 pr-4">
                                                {item.solucaoProposta ? (
                                                    <div className={`text-zinc-400 text-xs whitespace-pre-line break-words ${clampSolucao}`}>{item.solucaoProposta}</div>
                                                ) : (
                                                    <span className="text-zinc-600 text-xs italic">—</span>
                                                )}
                                            </td>
                                        )}
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
