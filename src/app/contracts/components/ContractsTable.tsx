'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Pencil, Trash2, Plus, Search, FileText, Loader2, Filter, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { ContratoRow } from '@/db/queries';
import { searchContratosAction, deleteContratoAction } from '../actions';
import { ContractModal } from './ContractModal';

interface ContractsTableProps {
    initialData: ContratoRow[];
    managersList: { id: string; name: string; role: string }[];
    readOnly?: boolean;
    lightActive?: boolean;
}

const GERENCIAS = ['GRC-1', 'GRC-2', 'GRC-3', 'GRC-4', 'GRC-C', 'KAM-1', 'KAM-2', 'KAM-3', 'KAM-4'];

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

function SituacaoBadge({ situacao, vigente, lightActive }: { situacao: string | null; vigente: boolean | null; lightActive: boolean }) {
    const isVigente = vigente === true || situacao?.toLowerCase() === 'vigente';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap
            ${isVigente
                ? (lightActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30')
                : (lightActive ? 'bg-zinc-100 text-zinc-500 border border-zinc-300' : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30')
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isVigente ? (lightActive ? 'bg-emerald-500' : 'bg-emerald-400') : (lightActive ? 'bg-zinc-400' : 'bg-zinc-500')}`} />
            {situacao || (isVigente ? 'Vigente' : 'Inativo')}
        </span>
    );
}

function TipoBadge({ tipo, lightActive }: { tipo: string | null; lightActive: boolean }) {
    const isSustentacao = tipo?.toUpperCase().includes('SUSTENT');
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap
            ${isSustentacao
                ? (lightActive ? 'bg-indigo-50 text-indigo-700 border border-indigo-300' : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25')
                : (lightActive ? 'bg-amber-50 text-amber-700 border border-amber-300' : 'bg-amber-500/15 text-amber-400 border border-amber-500/25')
            }`}>
            {isSustentacao ? 'Sustentação' : tipo || '—'}
        </span>
    );
}

type SortKey =
    | 'numeroContrato'
    | 'cliente'
    | 'gerencia'
    | 'nomeGerente'
    | 'vlContratado'
    | 'vlFaturado'
    | 'vlSaldo'
    | 'tipo'
    | 'situacao'
    | 'dtFimVigencia';

type SortDir = 'asc' | 'desc';

const NUMERIC_KEYS: SortKey[] = ['vlContratado', 'vlFaturado', 'vlSaldo'];
const DATE_KEYS: SortKey[] = ['dtFimVigencia'];

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
            className={`w-full flex items-center gap-1.5 ${justify} text-xs font-semibold uppercase tracking-wider transition-colors ${active ? (lightActive ? 'text-indigo-600' : 'text-indigo-300') : (lightActive ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-500 hover:text-zinc-300')}`}
        >
            <span>{label}</span>
            <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
    );
}

export function ContractsTable({ initialData, managersList, readOnly = false, lightActive = false }: ContractsTableProps) {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [contratos, setContratos] = useState<ContratoRow[]>(initialData);
    const [isPending, startTransition] = useTransition();
    const [isSearching, setIsSearching] = useState(false);

    // Column Filters state
    const [selectedGerencia, setSelectedGerencia] = useState<string>('TODAS');
    const [selectedGerente, setSelectedGerente] = useState<string>('TODOS');
    const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');
    const [selectedSituacao, setSelectedSituacao] = useState<string>('TODAS');

    // Sorting state
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingContrato, setEditingContrato] = useState<ContratoRow | null>(null);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Trigger server search on debounced value
    useEffect(() => {
        setIsSearching(true);
        startTransition(async () => {
            const results = await searchContratosAction(debouncedSearch);
            setContratos(results);
            setIsSearching(false);
        });
    }, [debouncedSearch]);

    // Unique options for column filters
    const availableGerencias = useMemo(() => {
        const set = new Set<string>();
        contratos.forEach((c) => c.gerencia && set.add(c.gerencia));
        return Array.from(set).sort();
    }, [contratos]);

    const availableGerentes = useMemo(() => {
        const set = new Set<string>();
        contratos.forEach((c) => {
            const name = c.nomeGerente || c.managerName;
            if (name) set.add(name);
        });
        return Array.from(set).sort();
    }, [contratos]);

    const availableTipos = useMemo(() => {
        const set = new Set<string>();
        contratos.forEach((c) => c.tipo && set.add(c.tipo));
        return Array.from(set).sort();
    }, [contratos]);

    const availableSituacoes = useMemo(() => {
        const set = new Set<string>();
        contratos.forEach((c) => {
            const sit = c.situacao || (c.vigente ? 'Vigente' : 'Inativo');
            set.add(sit);
        });
        return Array.from(set).sort();
    }, [contratos]);

    // Filtered Contratos
    const filteredContratos = useMemo(() => {
        return contratos.filter((c) => {
            if (selectedGerencia !== 'TODAS' && c.gerencia !== selectedGerencia) return false;

            const name = c.nomeGerente || c.managerName || '';
            if (selectedGerente !== 'TODOS' && name !== selectedGerente) return false;

            if (selectedTipo !== 'TODOS' && c.tipo !== selectedTipo) return false;

            const sit = c.situacao || (c.vigente ? 'Vigente' : 'Inativo');
            if (selectedSituacao !== 'TODAS' && sit !== selectedSituacao) return false;

            return true;
        });
    }, [contratos, selectedGerencia, selectedGerente, selectedTipo, selectedSituacao]);

    // Sorted & Filtered Contratos
    const displayContratos = useMemo(() => {
        if (!sortKey) return filteredContratos;
        return [...filteredContratos].sort((a, b) => {
            const aVal = sortKey === 'nomeGerente' ? (a.nomeGerente || a.managerName) : (a as any)[sortKey];
            const bVal = sortKey === 'nomeGerente' ? (b.nomeGerente || b.managerName) : (b as any)[sortKey];
            const cmp = compareValues(aVal, bVal, sortKey);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filteredContratos, sortKey, sortDir]);

    const hasActiveFilters =
        selectedGerencia !== 'TODAS' ||
        selectedGerente !== 'TODOS' ||
        selectedTipo !== 'TODOS' ||
        selectedSituacao !== 'TODAS' ||
        search !== '';

    function clearFilters() {
        setSelectedGerencia('TODAS');
        setSelectedGerente('TODOS');
        setSelectedTipo('TODOS');
        setSelectedSituacao('TODAS');
        setSearch('');
    }

    function handleEdit(row: ContratoRow) {
        setEditingContrato(row);
        setModalMode('edit');
        setModalOpen(true);
    }

    function handleAdd() {
        setEditingContrato(null);
        setModalMode('add');
        setModalOpen(true);
    }

    async function handleDelete(id: string, numero: string) {
        if (!confirm(`Tem certeza que deseja excluir o contrato ${numero}?`)) return;
        startTransition(async () => {
            const result = await deleteContratoAction(id);
            if (result.success) {
                const results = await searchContratosAction(debouncedSearch);
                setContratos(results);
            } else {
                alert(`Erro ao excluir: ${result.error}`);
            }
        });
    }

    function handleModalSuccess() {
        setModalOpen(false);
        startTransition(async () => {
            const results = await searchContratosAction(debouncedSearch);
            setContratos(results);
        });
    }

    // Summary stats based on filtered list
    const totalVlContratado = filteredContratos.reduce((sum, c) => sum + (c.vlContratado ?? 0), 0);
    const countVigentes = filteredContratos.filter((c) => c.vigente || c.situacao?.toLowerCase() === 'vigente').length;

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
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3">
                <div className={`border rounded-xl p-4 transition-colors duration-200 ${T.panel}`}>
                    <p className={`text-xs uppercase tracking-wider mb-1 ${T.subtext}`}>Total de Contratos</p>
                    <p className={`text-2xl font-bold ${T.heading}`}>{filteredContratos.length}</p>
                </div>
                <div className={`border rounded-xl p-4 transition-colors duration-200 ${T.panel}`}>
                    <p className={`text-xs uppercase tracking-wider mb-1 ${T.subtext}`}>Vigentes</p>
                    <p className={`text-2xl font-bold ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>{countVigentes}</p>
                </div>
                <div className={`border rounded-xl p-4 transition-colors duration-200 ${T.panel}`}>
                    <p className={`text-xs uppercase tracking-wider mb-1 ${T.subtext}`}>Valor Total Contratado</p>
                    <p className={`text-2xl font-bold ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(totalVlContratado)}
                    </p>
                </div>
            </div>

            {/* Toolbar & Filters */}
            <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 rounded-xl border transition-colors duration-200 ${T.panelSoft}`}>
                <div className="relative flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${T.mutedIcon}`} />
                    {isSearching && (
                        <Loader2 className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin ${lightActive ? 'text-indigo-500' : 'text-indigo-400'}`} />
                    )}
                    <input
                        id="contract-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por contrato, cliente, gerente, objeto..."
                        className={`w-full h-10 pl-9 pr-4 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all ${T.inputBg}`}
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
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer ${T.selectBg}`}
                        >
                            <option value="TODAS">Todas</option>
                            {availableGerencias.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Gerente */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${T.filterLabel}`}>Gerente:</span>
                        <select
                            value={selectedGerente}
                            onChange={(e) => setSelectedGerente(e.target.value)}
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[150px] truncate ${T.selectBg}`}
                        >
                            <option value="TODOS">Todos</option>
                            {availableGerentes.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Tipo */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${T.filterLabel}`}>Tipo:</span>
                        <select
                            value={selectedTipo}
                            onChange={(e) => setSelectedTipo(e.target.value)}
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer ${T.selectBg}`}
                        >
                            <option value="TODOS">Todos</option>
                            {availableTipos.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Situação */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${T.filterLabel}`}>Situação:</span>
                        <select
                            value={selectedSituacao}
                            onChange={(e) => setSelectedSituacao(e.target.value)}
                            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer ${T.selectBg}`}
                        >
                            <option value="TODAS">Todas</option>
                            {availableSituacoes.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className={`flex items-center gap-1 text-xs px-2 py-1 transition-colors font-medium ${lightActive ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-400 hover:text-indigo-300'}`}
                        >
                            <X className="w-3.5 h-3.5" />
                            Limpar
                        </button>
                    )}
                </div>

                {!readOnly && (
                    <button
                        id="add-contract-btn"
                        onClick={handleAdd}
                        className="flex items-center gap-2 h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-indigo-500/20 ml-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Contrato
                    </button>
                )}
            </div>

            {/* Table */}
            <div className={`flex-1 overflow-hidden rounded-xl border flex flex-col transition-colors duration-200 ${T.tableWrap}`}>
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full text-sm min-w-[1280px]">
                        <thead className="sticky top-0 z-10">
                            <tr className={`border-b ${T.theadBg}`}>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Contrato" sortKey="numeroContrato" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Cliente" sortKey="cliente" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="GRC" sortKey="gerencia" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Gerente" sortKey="nomeGerente" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Contratado" sortKey="vlContratado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Faturado" sortKey="vlFaturado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Saldo" sortKey="vlSaldo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Tipo" sortKey="tipo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Situação" sortKey="situacao" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Vencimento" sortKey="dtFimVigencia" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} lightActive={lightActive} />
                                </th>
                                {!readOnly && <th className={`text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${T.subtext}`}>Ações</th>}
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${T.tbodyDivide}`}>
                            {displayContratos.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className={`py-16 text-center ${T.subtext}`}>
                                        <div className="flex flex-col items-center gap-3">
                                            <FileText className={`w-10 h-10 ${lightActive ? 'text-zinc-300' : 'text-zinc-700'}`} />
                                            <p className="text-sm">Nenhum contrato encontrado com os filtros aplicados.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayContratos.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={`group transition-colors ${T.rowHover}`}
                                    >
                                        <td className={`px-4 py-3 font-mono text-xs whitespace-nowrap ${lightActive ? 'text-indigo-600' : 'text-indigo-300'}`}>{row.numeroContrato}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap font-medium ${T.rowText}`} title={row.cliente}>{row.cliente}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border whitespace-nowrap ${T.pillMuted}`}>
                                                {row.gerencia || '—'}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap font-medium ${T.rowMuted}`}>{row.nomeGerente || row.managerName || '—'}</td>
                                        <td className={`px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap ${T.rowText}`}>{formatCurrency(row.vlContratado)}</td>
                                        <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${T.rowFaded}`}>{formatCurrency(row.vlFaturado)}</td>
                                        <td className={`px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap ${(row.vlSaldo ?? 0) < 0 ? (lightActive ? 'text-rose-600' : 'text-rose-400') : (lightActive ? 'text-emerald-600' : 'text-emerald-400')}`}>
                                            {formatCurrency(row.vlSaldo)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap"><TipoBadge tipo={row.tipo} lightActive={lightActive} /></td>
                                        <td className="px-4 py-3 whitespace-nowrap"><SituacaoBadge situacao={row.situacao} vigente={row.vigente} lightActive={lightActive} /></td>
                                        <td className={`px-4 py-3 text-xs whitespace-nowrap ${T.rowFaded}`}>{formatDate(row.dtFimVigencia)}</td>
                                        {!readOnly && (
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        id={`edit-contract-${row.id}`}
                                                        onClick={() => handleEdit(row)}
                                                        title="Editar contrato"
                                                        className={`p-1.5 rounded-md hover:bg-indigo-500/20 transition-colors ${lightActive ? 'text-zinc-400 hover:text-indigo-600' : 'text-zinc-500 hover:text-indigo-400'}`}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        id={`delete-contract-${row.id}`}
                                                        onClick={() => handleDelete(row.id, row.numeroContrato)}
                                                        title="Excluir contrato"
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
                {displayContratos.length > 0 && (
                    <div className={`flex-none border-t px-4 py-2 text-xs ${T.footerBorder} ${T.footerText}`}>
                        {displayContratos.length} contrato{displayContratos.length !== 1 ? 's' : ''} exibido{displayContratos.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {/* Modal — only rendered in edit mode */}
            {!readOnly && (
                <ContractModal
                    open={modalOpen}
                    mode={modalMode}
                    contrato={editingContrato}
                    managersList={managersList}
                    gerencias={GERENCIAS}
                    onClose={() => setModalOpen(false)}
                    onSuccess={handleModalSuccess}
                    lightActive={lightActive}
                />
            )}
        </div>
    );
}
