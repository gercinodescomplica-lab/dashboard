'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { CXBoardItem } from '@/db/queries';
import { CXStatus } from '@/types/manager';
import {
    fetchCXPlannerBoardItems,
    fetchManagersForDropdown,
    createCXPlannerItem,
    updateCXPlannerItem,
    deleteCXPlannerItem,
    moveCXPlannerItem,
    CXPlannerFormValues,
} from './actions';
import { CXPlannerCard } from './CXPlannerCard';
import { CXPlannerItemModal } from './CXPlannerItemModal';
import { STATUS_COLUMNS } from './board-config';

interface ManagerOption {
    id: string;
    name: string;
}

export function CXPlannerBoard() {
    const [items, setItems] = useState<CXBoardItem[]>([]);
    const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CXBoardItem | null>(null);
    const [defaultStatusForNew, setDefaultStatusForNew] = useState<CXStatus>('pendente');
    const [dragOverStatus, setDragOverStatus] = useState<CXStatus | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const [managerFilter, setManagerFilter] = useState('');
    const [clienteFilter, setClienteFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<CXStatus | ''>('');

    // Shared by the initial mount load and the manual "Atualizar" button —
    // with several concurrent editors on this board, each open tab holds an
    // increasingly stale snapshot; this gives editors an easy way to pull
    // the latest state before starting an edit (see finding #5 of the final
    // review — full real-time sync is out of scope for this fix pass).
    const loadBoard = useCallback(async () => {
        const [boardItems, managers] = await Promise.all([
            fetchCXPlannerBoardItems(),
            fetchManagersForDropdown(),
        ]);
        setItems(boardItems);
        setManagerOptions(managers);
    }, []);

    useEffect(() => {
        (async () => {
            await loadBoard();
            setIsLoading(false);
        })();
    }, [loadBoard]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await loadBoard();
        } finally {
            setIsRefreshing(false);
        }
    };

    const openCreate = (status: CXStatus) => {
        setEditingItem(null);
        setDefaultStatusForNew(status);
        setModalOpen(true);
    };

    const openEdit = (item: CXBoardItem) => {
        setEditingItem(item);
        setModalOpen(true);
    };

    const handleSave = async (values: CXPlannerFormValues) => {
        if (editingItem) {
            const updated = await updateCXPlannerItem(editingItem.id!, values);
            if (!updated) {
                // createCXPlannerItem/updateCXPlannerItem return null when the
                // target manager was deleted meanwhile (or similar) — throwing
                // here lets the modal's try/catch surface an error instead of
                // silently closing as if the save succeeded.
                throw new Error('Não foi possível salvar: gerente ou item não encontrado.');
            }
            setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
        } else {
            const created = await createCXPlannerItem(values);
            if (!created) {
                throw new Error('Não foi possível criar o item: gerente não encontrado.');
            }
            setItems((prev) => [...prev, created]);
        }
    };

    const handleDelete = async () => {
        if (!editingItem) return;
        await deleteCXPlannerItem(editingItem.id!);
        setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
    };

    const handleDrop = async (status: CXStatus, e: React.DragEvent) => {
        e.preventDefault();
        setDragOverStatus(null);
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (!id) return;
        const previous = items.find((i) => i.id === id);
        if (!previous || previous.status === status) return;

        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
        const result = await moveCXPlannerItem(id, status);
        if (!result) {
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: previous.status } : i)));
        }
    };

    // Opções dos selects de Gerente/Cliente — derivadas dos dados que
    // realmente estão no board agora (não de uma lista fixa), pra nunca
    // oferecer um filtro que não bate com nada. managerOptions já cobre
    // todo mundo cadastrado; cliente é texto livre então precisa ser
    // extraído dos itens.
    const clienteOptions = useMemo(
        () => Array.from(new Set(items.map((i) => i.cliente).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [items]
    );

    // Filtro combinado (AND entre todos): busca livre + os 3 selects. Nenhum
    // filtro aqui inventa categoria — gerente/cliente/status vêm direto dos
    // valores reais dos itens (ver clienteOptions acima e STATUS_COLUMNS), e
    // "data" não virou um select de faixas fixas (ex: "atrasados"/"próximos
    // 7 dias") porque isso deixaria de fora qualquer item cuja data não
    // coubesse em nenhum balde — em vez disso, data início/prazo entram na
    // busca de texto abaixo, então qualquer data digitada (ex: "05/08")
    // encontra o item, sem nenhum item ficar sem categoria pra cair. `items`
    // (não filtrado) continua sendo a fonte usada pelas mutações acima; só a
    // renderização das colunas usa a lista filtrada.
    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase();

        return items.filter((item) => {
            if (managerFilter && item.managerId !== managerFilter) return false;
            if (clienteFilter && item.cliente !== clienteFilter) return false;
            if (statusFilter && item.status !== statusFilter) return false;

            if (!q) return true;
            const haystack = [
                item.managerName,
                item.cliente,
                item.titulo,
                item.problema,
                item.solucaoProposta,
                item.prioridadeTexto,
                item.dataInicio,
                item.dataFim,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [items, query, managerFilter, clienteFilter, statusFilter]);

    const hasActiveFilter = Boolean(query || managerFilter || clienteFilter || statusFilter);
    const clearFilters = () => {
        setQuery('');
        setManagerFilter('');
        setClienteFilter('');
        setStatusFilter('');
    };

    const selectClassName = 'bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-colors';

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">CX Planner</h1>
                    <p className="text-zinc-500 text-sm">Board de CX do time — arraste os cards entre as colunas ou clique para editar.</p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Buscar estado mais recente do board"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:text-zinc-100 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            <div className="mb-4 flex flex-col gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar por título, descrição, prioridade ou data..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                    </div>
                    <div className="text-xs text-zinc-500 whitespace-nowrap">
                        Mostrando <span className="font-semibold text-zinc-300">{filteredItems.length}</span> de {items.length}
                    </div>
                    {hasActiveFilter && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                        >
                            <X className="w-3 h-3" /> Limpar filtros
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={managerFilter}
                        onChange={(e) => setManagerFilter(e.target.value)}
                        className={selectClassName}
                    >
                        <option value="">Todos os gerentes</option>
                        {managerOptions.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>

                    <select
                        value={clienteFilter}
                        onChange={(e) => setClienteFilter(e.target.value)}
                        className={selectClassName}
                    >
                        <option value="">Todos os clientes</option>
                        {clienteOptions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as CXStatus | '')}
                        className={selectClassName}
                    >
                        <option value="">Todos os status</option>
                        {STATUS_COLUMNS.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STATUS_COLUMNS.map((col) => {
                    const colItems = filteredItems.filter((i) => i.status === col.key);
                    return (
                        <div
                            key={col.key}
                            onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.key); }}
                            onDragLeave={() => setDragOverStatus((s) => (s === col.key ? null : s))}
                            onDrop={(e) => handleDrop(col.key, e)}
                            className={`rounded-xl border p-3 flex flex-col gap-3 min-h-[200px] transition-colors ${dragOverStatus === col.key ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/30'}`}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">{col.label} ({colItems.length})</h2>
                                <button
                                    type="button"
                                    onClick={() => openCreate(col.key)}
                                    className="text-zinc-500 hover:text-indigo-400 transition-colors"
                                    title="Nova tarefa"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {colItems.map((item) => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(item.id))}
                                    >
                                        <CXPlannerCard item={item} onClick={() => openEdit(item)} />
                                    </div>
                                ))}
                                {colItems.length === 0 && (
                                    <p className="text-xs text-zinc-700 text-center py-6">
                                        {hasActiveFilter ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <CXPlannerItemModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                item={editingItem}
                managerOptions={managerOptions}
                defaultManagerId={managerOptions[0]?.id}
                defaultStatus={defaultStatusForNew}
                onSave={handleSave}
                onDelete={editingItem ? handleDelete : undefined}
            />
        </div>
    );
}
