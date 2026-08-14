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

function SituacaoBadge({ situacao, vigente }: { situacao: string | null; vigente: boolean | null }) {
    const isVigente = vigente === true || situacao?.toLowerCase() === 'vigente';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap
            ${isVigente
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isVigente ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            {situacao || (isVigente ? 'Vigente' : 'Inativo')}
        </span>
    );
}

function TipoBadge({ tipo }: { tipo: string | null }) {
    const isSustentacao = tipo?.toUpperCase().includes('SUSTENT');
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap
            ${isSustentacao
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
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
}: {
    label: string;
    sortKey: SortKey;
    currentKey: SortKey | null;
    currentDir: SortDir;
    onSort: (k: SortKey) => void;
    align?: 'left' | 'right' | 'center';
}) {
    const active = currentKey === sortKey;
    const Icon = !active ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
    const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`w-full flex items-center gap-1.5 ${justify} text-xs font-semibold uppercase tracking-wider transition-colors ${active ? 'text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
            <span>{label}</span>
            <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
    );
}

export function ContractsTable({ initialData, managersList, readOnly = false }: ContractsTableProps) {
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

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total de Contratos</p>
                    <p className="text-2xl font-bold text-zinc-100">{filteredContratos.length}</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Vigentes</p>
                    <p className="text-2xl font-bold text-emerald-400">{countVigentes}</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Valor Total Contratado</p>
                    <p className="text-2xl font-bold text-indigo-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(totalVlContratado)}
                    </p>
                </div>
            </div>

            {/* Toolbar & Filters */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                    )}
                    <input
                        id="contract-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por contrato, cliente, gerente, objeto..."
                        className="w-full h-10 pl-9 pr-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    />
                </div>

                {/* Dropdown Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter GRC */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-400">GRC:</span>
                        <select
                            value={selectedGerencia}
                            onChange={(e) => setSelectedGerencia(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="TODAS">Todas</option>
                            {availableGerencias.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Gerente */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-400">Gerente:</span>
                        <select
                            value={selectedGerente}
                            onChange={(e) => setSelectedGerente(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[150px] truncate"
                        >
                            <option value="TODOS">Todos</option>
                            {availableGerentes.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Tipo */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-400">Tipo:</span>
                        <select
                            value={selectedTipo}
                            onChange={(e) => setSelectedTipo(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="TODOS">Todos</option>
                            {availableTipos.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Situação */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-400">Situação:</span>
                        <select
                            value={selectedSituacao}
                            onChange={(e) => setSelectedSituacao(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 transition-colors font-medium"
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
            <div className="flex-1 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full text-sm min-w-[1280px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-zinc-950 border-b border-zinc-800">
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Contrato" sortKey="numeroContrato" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Cliente" sortKey="cliente" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="GRC" sortKey="gerencia" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Gerente" sortKey="nomeGerente" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Contratado" sortKey="vlContratado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Faturado" sortKey="vlFaturado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Saldo" sortKey="vlSaldo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Tipo" sortKey="tipo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Situação" sortKey="situacao" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap">
                                    <SortHeader label="Vencimento" sortKey="dtFimVigencia" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                                </th>
                                {!readOnly && <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {displayContratos.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-zinc-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <FileText className="w-10 h-10 text-zinc-700" />
                                            <p className="text-sm">Nenhum contrato encontrado com os filtros aplicados.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayContratos.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="group hover:bg-zinc-800/40 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-mono text-xs text-indigo-300 whitespace-nowrap">{row.numeroContrato}</td>
                                        <td className="px-4 py-3 text-zinc-200 whitespace-nowrap font-medium" title={row.cliente}>{row.cliente}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700/50 whitespace-nowrap">
                                                {row.gerencia || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap font-medium">{row.nomeGerente || row.managerName || '—'}</td>
                                        <td className="px-4 py-3 text-right text-zinc-200 font-medium tabular-nums whitespace-nowrap">{formatCurrency(row.vlContratado)}</td>
                                        <td className="px-4 py-3 text-right text-zinc-400 tabular-nums whitespace-nowrap">{formatCurrency(row.vlFaturado)}</td>
                                        <td className={`px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap ${(row.vlSaldo ?? 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {formatCurrency(row.vlSaldo)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap"><TipoBadge tipo={row.tipo} /></td>
                                        <td className="px-4 py-3 whitespace-nowrap"><SituacaoBadge situacao={row.situacao} vigente={row.vigente} /></td>
                                        <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.dtFimVigencia)}</td>
                                        {!readOnly && (
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        id={`edit-contract-${row.id}`}
                                                        onClick={() => handleEdit(row)}
                                                        title="Editar contrato"
                                                        className="p-1.5 rounded-md hover:bg-indigo-500/20 hover:text-indigo-400 text-zinc-500 transition-colors"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        id={`delete-contract-${row.id}`}
                                                        onClick={() => handleDelete(row.id, row.numeroContrato)}
                                                        title="Excluir contrato"
                                                        className="p-1.5 rounded-md hover:bg-rose-500/20 hover:text-rose-400 text-zinc-500 transition-colors"
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
                    <div className="flex-none border-t border-zinc-800/80 px-4 py-2 text-xs text-zinc-600">
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
                />
            )}
        </div>
    );
}
