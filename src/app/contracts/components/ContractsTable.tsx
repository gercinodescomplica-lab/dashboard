'use client';

import { useState, useEffect, useTransition } from 'react';
import { Pencil, Trash2, Plus, Search, FileText, Loader2, AlertCircle } from 'lucide-react';
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

export function ContractsTable({ initialData, managersList, readOnly = false }: ContractsTableProps) {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [contratos, setContratos] = useState<ContratoRow[]>(initialData);
    const [isPending, startTransition] = useTransition();
    const [isSearching, setIsSearching] = useState(false);

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

    // Summary stats
    const totalVlContratado = contratos.reduce((sum, c) => sum + (c.vlContratado ?? 0), 0);
    const countVigentes = contratos.filter(c => c.vigente).length;

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total de Contratos</p>
                    <p className="text-2xl font-bold text-zinc-100">{contratos.length}</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Vigentes</p>
                    <p className="text-2xl font-bold text-emerald-400">{countVigentes}</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Valor Total Contratado</p>
                    <p className="text-2xl font-bold text-indigo-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(totalVlContratado)}</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
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
                        className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    />
                </div>
                {!readOnly && (
                    <button
                        id="add-contract-btn"
                        onClick={handleAdd}
                        className="flex items-center gap-2 h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Contrato
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full text-sm min-w-[1100px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-zinc-900 border-b border-zinc-800">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Contrato</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cliente</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">GRC</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Gerente</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Contratado</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Faturado</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Saldo</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Situação</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Vencimento</th>
                                {!readOnly && <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {contratos.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-zinc-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <FileText className="w-10 h-10 text-zinc-700" />
                                            <p className="text-sm">Nenhum contrato encontrado{search ? ` para "${search}"` : ''}.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                contratos.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="group hover:bg-zinc-800/40 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-mono text-xs text-indigo-300 whitespace-nowrap">{row.numeroContrato}</td>
                                        <td className="px-4 py-3 text-zinc-200 max-w-[200px] truncate" title={row.cliente}>{row.cliente}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                                                {row.gerencia || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{row.nomeGerente || row.managerName || '—'}</td>
                                        <td className="px-4 py-3 text-right text-zinc-200 font-medium tabular-nums whitespace-nowrap">{formatCurrency(row.vlContratado)}</td>
                                        <td className="px-4 py-3 text-right text-zinc-400 tabular-nums whitespace-nowrap">{formatCurrency(row.vlFaturado)}</td>
                                        <td className={`px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap ${(row.vlSaldo ?? 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {formatCurrency(row.vlSaldo)}
                                        </td>
                                        <td className="px-4 py-3"><TipoBadge tipo={row.tipo} /></td>
                                        <td className="px-4 py-3"><SituacaoBadge situacao={row.situacao} vigente={row.vigente} /></td>
                                        <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.dtFimVigencia)}</td>
                                        {!readOnly && (
                                            <td className="px-4 py-3">
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
                {contratos.length > 0 && (
                    <div className="flex-none border-t border-zinc-800/80 px-4 py-2 text-xs text-zinc-600">
                        {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} exibido{contratos.length !== 1 ? 's' : ''}
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
