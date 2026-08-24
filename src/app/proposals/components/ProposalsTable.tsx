'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Pencil, Trash2, Plus, Search, Handshake, Loader2, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react';
import { PropostaRow } from '@/db/queries';
import { searchPropostasAction, deletePropostaAction } from '../actions';
import { ProposalModal } from './ProposalModal';

interface ProposalsTableProps {
    initialData: PropostaRow[];
    managersList: { id: string; name: string; role: string }[];
    readOnly?: boolean;
    lightActive?: boolean;
}

const GERENCIAS = ['GRC-1', 'GRC-2', 'GRC-3', 'GRC-4', 'GRC-C', 'KAM-1', 'KAM-2', 'KAM-3', 'KAM-4'];
const FASES = [
    'Elaboração de proposta',
    'Em análise / aprovação',
    'Em ajustes / revisão',
    'Proposta em cliente',
    'Contrato em cliente',
];

const STATUS_OPTIONS = [
    'Pendente',
    'Aguardando',
    'Previsto Jul/2026',
    'Previsto Ago/2026',
    'Previsto Set/2026',
    'Previsto Out/2026',
    'Adiado',
    'Assinado',
    'Sem previsão',
];

const STATUS_COLORS_DARK: Record<string, string> = {
    'Assinado': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'Adiado': 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',
    'Aguardando': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'Pendente': 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    'Sem previsão': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};
const STATUS_COLORS_LIGHT: Record<string, string> = {
    'Assinado': 'bg-emerald-50 text-emerald-700 border-emerald-300',
    'Adiado': 'bg-zinc-100 text-zinc-600 border-zinc-300',
    'Aguardando': 'bg-amber-50 text-amber-700 border-amber-300',
    'Pendente': 'bg-sky-50 text-sky-700 border-sky-300',
    'Sem previsão': 'bg-rose-50 text-rose-700 border-rose-300',
};

function StatusBadge({ status, lightActive }: { status: string | null; lightActive: boolean }) {
    if (!status) return <span className={lightActive ? 'text-zinc-400' : 'text-zinc-600'}>—</span>;
    const key = status.startsWith('Previsto') ? 'Previsto' : status;
    const map = lightActive ? STATUS_COLORS_LIGHT : STATUS_COLORS_DARK;
    const cls =
        map[key] ??
        (status.startsWith('Previsto')
            ? (lightActive ? 'bg-violet-50 text-violet-700 border-violet-300' : 'bg-violet-500/15 text-violet-300 border-violet-500/30')
            : (lightActive ? 'bg-zinc-100 text-zinc-600 border-zinc-300' : 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40'));
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap border ${cls}`}>
            {status}
        </span>
    );
}

function formatCurrency(val: number | null): string {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(val);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

const FASE_COLORS_DARK: Record<string, string> = {
    'Elaboração de proposta': 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',
    'Em análise / aprovação': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'Em ajustes / revisão': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    'Proposta em cliente': 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    'Contrato em cliente': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};
const FASE_COLORS_LIGHT: Record<string, string> = {
    'Elaboração de proposta': 'bg-zinc-100 text-zinc-600 border-zinc-300',
    'Em análise / aprovação': 'bg-amber-50 text-amber-700 border-amber-300',
    'Em ajustes / revisão': 'bg-orange-50 text-orange-700 border-orange-300',
    'Proposta em cliente': 'bg-sky-50 text-sky-700 border-sky-300',
    'Contrato em cliente': 'bg-emerald-50 text-emerald-700 border-emerald-300',
};

function FaseBadge({ fase, lightActive }: { fase: string | null; lightActive: boolean }) {
    if (!fase) return <span className={lightActive ? 'text-zinc-400' : 'text-zinc-600'}>—</span>;
    const map = lightActive ? FASE_COLORS_LIGHT : FASE_COLORS_DARK;
    const cls = map[fase] ?? (lightActive ? 'bg-zinc-100 text-zinc-600 border-zinc-300' : 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40');
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap border ${cls}`}>
            {fase}
        </span>
    );
}

function ProbabilidadeBar({ p, lightActive }: { p: number | null; lightActive: boolean }) {
    if (p === null || p === undefined) return <span className={`text-xs ${lightActive ? 'text-zinc-400' : 'text-zinc-600'}`}>—</span>;
    const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
    const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
    return (
        <div className="flex items-center gap-2 min-w-[80px]">
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${lightActive ? 'bg-zinc-200' : 'bg-zinc-800'}`}>
                <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs tabular-nums w-9 text-right ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>{pct}%</span>
        </div>
    );
}

type SortKey =
    | 'numeroProposta'
    | 'nomeOportunidade'
    | 'cliente'
    | 'gerencia'
    | 'proprietario'
    | 'fase'
    | 'status'
    | 'valor'
    | 'receitaEsperada'
    | 'probabilidade'
    | 'dataFechamento';

type SortDir = 'asc' | 'desc';

const NUMERIC_KEYS: SortKey[] = ['valor', 'receitaEsperada', 'probabilidade'];
const DATE_KEYS: SortKey[] = ['dataFechamento'];

function compareValues(a: any, b: any, key: SortKey): number {
    const aNull = a === null || a === undefined || a === '';
    const bNull = b === null || b === undefined || b === '';
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    if (NUMERIC_KEYS.includes(key)) {
        return (a as number) - (b as number);
    }
    if (DATE_KEYS.includes(key)) {
        return String(a).localeCompare(String(b));
    }
    return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base', numeric: true });
}

function SortHeader({
    label,
    sortKey,
    currentKey,
    currentDir,
    onSort,
    align = 'left',
    lightActive,
}: {
    label: string;
    sortKey: SortKey;
    currentKey: SortKey | null;
    currentDir: SortDir;
    onSort: (k: SortKey) => void;
    align?: 'left' | 'right' | 'center';
    lightActive: boolean;
}) {
    const active = currentKey === sortKey;
    const Icon = !active ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
    const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`w-full flex items-center gap-1.5 ${justify} text-xs font-semibold uppercase tracking-wider transition-colors ${active ? (lightActive ? 'text-emerald-600' : 'text-emerald-300') : (lightActive ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-500 hover:text-zinc-300')}`}
        >
            <span>{label}</span>
            <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
    );
}

export function ProposalsTable({ initialData, managersList, readOnly = false, lightActive = false }: ProposalsTableProps) {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [propostas, setPropostas] = useState<PropostaRow[]>(initialData);
    const [isPending, startTransition] = useTransition();
    const [isSearching, setIsSearching] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Column Filters state
    const [selectedGerencia, setSelectedGerencia] = useState<string>('TODAS');
    const [selectedProprietario, setSelectedProprietario] = useState<string>('TODOS');
    const [selectedFase, setSelectedFase] = useState<string>('TODAS');
    const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingProposta, setEditingProposta] = useState<PropostaRow | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setIsSearching(true);
        startTransition(async () => {
            const results = await searchPropostasAction(debouncedSearch);
            setPropostas(results);
            setIsSearching(false);
        });
    }, [debouncedSearch]);

    // Available filter options
    const availableGerencias = useMemo(() => {
        const set = new Set<string>();
        propostas.forEach((p) => p.gerencia && set.add(p.gerencia));
        return Array.from(set).sort();
    }, [propostas]);

    const availableProprietarios = useMemo(() => {
        const set = new Set<string>();
        propostas.forEach((p) => p.proprietario && set.add(p.proprietario));
        return Array.from(set).sort();
    }, [propostas]);

    const availableFases = useMemo(() => {
        const set = new Set<string>();
        propostas.forEach((p) => p.fase && set.add(p.fase));
        return Array.from(set).sort();
    }, [propostas]);

    const availableStatusOptions = useMemo(() => {
        const set = new Set<string>();
        propostas.forEach((p) => p.status && set.add(p.status));
        return Array.from(set).sort();
    }, [propostas]);

    // Filtered Propostas
    const filteredPropostas = useMemo(() => {
        return propostas.filter((p) => {
            if (selectedGerencia !== 'TODAS' && p.gerencia !== selectedGerencia) return false;
            if (selectedProprietario !== 'TODOS' && p.proprietario !== selectedProprietario) return false;
            if (selectedFase !== 'TODAS' && p.fase !== selectedFase) return false;
            if (selectedStatus !== 'TODOS' && p.status !== selectedStatus) return false;
            return true;
        });
    }, [propostas, selectedGerencia, selectedProprietario, selectedFase, selectedStatus]);

    const sortedPropostas = useMemo(() => {
        if (!sortKey) return filteredPropostas;
        return [...filteredPropostas].sort((a, b) => {
            const cmp = compareValues((a as any)[sortKey], (b as any)[sortKey], sortKey);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filteredPropostas, sortKey, sortDir]);

    const hasActiveFilters =
        selectedGerencia !== 'TODAS' ||
        selectedProprietario !== 'TODOS' ||
        selectedFase !== 'TODAS' ||
        selectedStatus !== 'TODOS' ||
        search !== '';

    function clearFilters() {
        setSelectedGerencia('TODAS');
        setSelectedProprietario('TODOS');
        setSelectedFase('TODAS');
        setSelectedStatus('TODOS');
        setSearch('');
    }

    function handleEdit(row: PropostaRow) {
        setEditingProposta(row);
        setModalMode('edit');
        setModalOpen(true);
    }

    function handleAdd() {
        setEditingProposta(null);
        setModalMode('add');
        setModalOpen(true);
    }

    async function handleDelete(id: string, numero: string) {
        if (!confirm(`Tem certeza que deseja excluir a proposta ${numero}?`)) return;
        startTransition(async () => {
            const result = await deletePropostaAction(id);
            if (result.success) {
                const results = await searchPropostasAction(debouncedSearch);
                setPropostas(results);
            } else {
                alert(`Erro ao excluir: ${result.error}`);
            }
        });
    }

    function handleModalSuccess() {
        setModalOpen(false);
        startTransition(async () => {
            const results = await searchPropostasAction(debouncedSearch);
            setPropostas(results);
        });
    }

    const totalValor = filteredPropostas.reduce((s, p) => s + (p.valor ?? 0), 0);
    const totalReceita = filteredPropostas.reduce((s, p) => s + (p.receitaEsperada ?? 0), 0);

    const T = {
        panel: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/60 border-zinc-800/80',
        panelSoft: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800/80',
        heading: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        subtext: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        mutedIcon: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        inputBg: lightActive ? 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400' : 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600',
        selectBg: lightActive ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-950 border-zinc-800 text-zinc-200',
        filterLabel: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        tableWrap: lightActive ? 'border-zinc-200 bg-white' : 'border-zinc-800/80 bg-zinc-900/40',
        theadBg: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-800',
        tbodyDivide: lightActive ? 'divide-zinc-200' : 'divide-zinc-800/50',
        rowHover: lightActive ? 'hover:bg-zinc-50' : 'hover:bg-zinc-800/40',
        rowText: lightActive ? 'text-zinc-800' : 'text-zinc-200',
        rowMuted: lightActive ? 'text-zinc-600' : 'text-zinc-300',
        rowFaded: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        pillMuted: lightActive ? 'bg-zinc-100 text-zinc-600 border-zinc-300' : 'bg-zinc-800 text-zinc-300 border-zinc-700/50',
        footerBorder: lightActive ? 'border-zinc-200' : 'border-zinc-800/80',
        footerText: lightActive ? 'text-zinc-500' : 'text-zinc-600',
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="grid grid-cols-3 gap-3">
                <div className={`border rounded-xl p-4 transition-colors duration-200 ${T.panel}`}>
                    <p className={`text-xs uppercase tracking-wider mb-1 ${T.subtext}`}>Total de Propostas</p>
                    <p className={`text-2xl font-bold ${T.heading}`}>{filteredPropostas.length}</p>
                </div>
                <div className={`border rounded-xl p-4 transition-colors duration-200 ${T.panel}`}>
                    <p className={`text-xs uppercase tracking-wider mb-1 ${T.subtext}`}>Valor Total</p>
                    <p className={`text-2xl font-bold ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(totalValor)}</p>
                </div>
                <div className={`border rounded-xl p-4 transition-colors duration-200 ${T.panel}`}>
                    <p className={`text-xs uppercase tracking-wider mb-1 ${T.subtext}`}>Receita Esperada</p>
                    <p className={`text-2xl font-bold ${lightActive ? 'text-sky-600' : 'text-sky-400'}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(totalReceita)}</p>
                </div>
            </div>

            <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 rounded-xl border transition-colors duration-200 ${T.panelSoft}`}>
                <div className="relative flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${T.mutedIcon}`} />
                    {isSearching && (
                        <Loader2 className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin ${lightActive ? 'text-emerald-500' : 'text-emerald-400'}`} />
                    )}
                    <input
                        id="proposal-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por número, cliente, oportunidade, proprietário..."
                        className={`w-full h-10 pl-9 pr-4 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all ${T.inputBg}`}
                    />
                </div>

                {/* Dropdown Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter GRC */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${T.filterLabel}`}>GRC:</span>
                        <select
                            value={selectedGerencia}
                            onChange={(e) => setSelectedGerencia(e.target.value)}
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer ${T.selectBg}`}
                        >
                            <option value="TODAS">Todas</option>
                            {availableGerencias.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Proprietário */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${T.filterLabel}`}>Proprietário:</span>
                        <select
                            value={selectedProprietario}
                            onChange={(e) => setSelectedProprietario(e.target.value)}
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[140px] truncate ${T.selectBg}`}
                        >
                            <option value="TODOS">Todos</option>
                            {availableProprietarios.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Fase */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${T.filterLabel}`}>Fase:</span>
                        <select
                            value={selectedFase}
                            onChange={(e) => setSelectedFase(e.target.value)}
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[150px] truncate ${T.selectBg}`}
                        >
                            <option value="TODAS">Todas</option>
                            {availableFases.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Status */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${T.filterLabel}`}>Status:</span>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[140px] truncate ${T.selectBg}`}
                        >
                            <option value="TODOS">Todos</option>
                            {availableStatusOptions.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className={`flex items-center gap-1 text-xs px-2 py-1 transition-colors font-medium ${lightActive ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'}`}
                        >
                            <X className="w-3.5 h-3.5" />
                            Limpar
                        </button>
                    )}
                </div>

                {!readOnly && (
                    <button
                        id="add-proposal-btn"
                        onClick={handleAdd}
                        className="flex items-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-emerald-500/20 ml-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Proposta
                    </button>
                )}
            </div>

            <div className={`flex-1 overflow-hidden rounded-xl border flex flex-col transition-colors duration-200 ${T.tableWrap}`}>
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full text-sm min-w-[1350px]">
                        <thead className="sticky top-0 z-10">
                            <tr className={`border-b ${T.theadBg}`}>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Proposta" sortKey="numeroProposta" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Oportunidade" sortKey="nomeOportunidade" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Cliente" sortKey="cliente" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="GRC" sortKey="gerencia" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Proprietário" sortKey="proprietario" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Fase" sortKey="fase" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Valor" sortKey="valor" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Receita Esp." sortKey="receitaEsperada" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Probab." sortKey="probabilidade" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                <th className="px-4 py-3 whitespace-nowrap"><SortHeader label="Fechamento" sortKey="dataFechamento" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} /></th>
                                {!readOnly && <th className={`text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${T.subtext}`}>Ações</th>}
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${T.tbodyDivide}`}>
                            {sortedPropostas.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className={`py-16 text-center ${T.subtext}`}>
                                        <div className="flex flex-col items-center gap-3">
                                            <Handshake className={`w-10 h-10 ${lightActive ? 'text-zinc-300' : 'text-zinc-700'}`} />
                                            <p className="text-sm">Nenhuma proposta encontrada com os filtros aplicados.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedPropostas.map((row) => (
                                    <tr key={row.id} className={`group transition-colors ${T.rowHover}`}>
                                        <td className={`px-4 py-3 font-mono text-xs whitespace-nowrap ${lightActive ? 'text-emerald-600' : 'text-emerald-300'}`}>{row.numeroProposta}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap font-medium ${T.rowText}`} title={row.nomeOportunidade}>{row.nomeOportunidade}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap ${T.rowMuted}`} title={row.cliente}>{row.cliente}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border whitespace-nowrap ${T.pillMuted}`}>
                                                {row.gerencia || '—'}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap font-medium text-xs ${T.rowMuted}`}>{row.proprietario || '—'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap"><FaseBadge fase={row.fase} lightActive={lightActive} /></td>
                                        <td className="px-4 py-3 whitespace-nowrap" title={row.observacao ?? ''}><StatusBadge status={row.status} lightActive={lightActive} /></td>
                                        <td className={`px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap ${T.rowText}`}>{formatCurrency(row.valor)}</td>
                                        <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${lightActive ? 'text-sky-600' : 'text-sky-400'}`}>{formatCurrency(row.receitaEsperada)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap"><ProbabilidadeBar p={row.probabilidade} lightActive={lightActive} /></td>
                                        <td className={`px-4 py-3 text-xs whitespace-nowrap ${T.rowFaded}`}>{formatDate(row.dataFechamento)}</td>
                                        {!readOnly && (
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        id={`edit-proposal-${row.id}`}
                                                        onClick={() => handleEdit(row)}
                                                        title="Editar proposta"
                                                        className={`p-1.5 rounded-md hover:bg-emerald-500/20 transition-colors ${lightActive ? 'text-zinc-400 hover:text-emerald-600' : 'text-zinc-500 hover:text-emerald-400'}`}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        id={`delete-proposal-${row.id}`}
                                                        onClick={() => handleDelete(row.id, row.numeroProposta)}
                                                        title="Excluir proposta"
                                                        className={`p-1.5 rounded-md hover:bg-rose-500/20 transition-colors ${lightActive ? 'text-zinc-400 hover:text-rose-600' : 'text-zinc-500 hover:text-rose-400'}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {sortedPropostas.length === 0 ? null : (
                    <div className={`flex-none border-t px-4 py-2 text-xs ${T.footerBorder} ${T.footerText}`}>
                        {sortedPropostas.length} proposta{sortedPropostas.length !== 1 ? 's' : ''} exibida{sortedPropostas.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {!readOnly && (
                <ProposalModal
                    open={modalOpen}
                    mode={modalMode}
                    proposta={editingProposta}
                    managersList={managersList}
                    gerencias={GERENCIAS}
                    fases={FASES}
                    statusOptions={STATUS_OPTIONS}
                    onClose={() => setModalOpen(false)}
                    onSuccess={handleModalSuccess}
                    lightActive={lightActive}
                />
            )}
        </div>
    );
}
