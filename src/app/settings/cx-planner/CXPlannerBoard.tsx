'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Search, X, Sun, Moon, Users, Download, MoreVertical, ChevronLeft, ChevronRight, Pencil, Trash2, Check, GripVertical } from 'lucide-react';
import { CXBoardItem, CXBucket, CXUser } from '@/db/queries';
import { applyBodyTheme, THEME_STORAGE_KEY } from '@/lib/themeSync';
import {
    fetchCXPlannerBoardData,
    createCXPlannerItem,
    updateCXPlannerItem,
    deleteCXPlannerItem,
    moveCXPlannerItem,
    createBucketAction,
    renameBucketAction,
    moveBucketAction,
    reorderBucketsAction,
    deleteBucketAction,
    CXPlannerFormValues,
} from './actions';
import { CXPlannerCard } from './CXPlannerCard';
import { CXPlannerItemModal } from './CXPlannerItemModal';
import { CXUsersModal } from './CXUsersModal';
import { PRIORIDADE_OPTIONS } from './board-config';

interface ManagerOption {
    id: string;
    name: string;
}

// bucketId null => coluna virtual "Entrada". Usamos essa sentinela como chave
// de coluna no board (nunca vai pro banco).
const ENTRADA = 'entrada';
type ColumnKey = number | typeof ENTRADA;

export function CXPlannerBoard() {
    const [items, setItems] = useState<CXBoardItem[]>([]);
    const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
    const [buckets, setBuckets] = useState<CXBucket[]>([]);
    const [users, setUsers] = useState<CXUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CXBoardItem | null>(null);
    const [defaultBucketForNew, setDefaultBucketForNew] = useState<number | null>(null);
    const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [usersModalOpen, setUsersModalOpen] = useState(false);

    const [query, setQuery] = useState('');
    const [managerFilter, setManagerFilter] = useState('');
    const [clienteFilter, setClienteFilter] = useState('');
    const [bucketFilter, setBucketFilter] = useState<string>('');
    const [responsavelFilter, setResponsavelFilter] = useState('');
    const [prioridadeFilter, setPrioridadeFilter] = useState('');

    const [newBucketMode, setNewBucketMode] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [renamingBucketId, setRenamingBucketId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [menuBucketId, setMenuBucketId] = useState<number | null>(null);
    const [confirmDeleteBucketId, setConfirmDeleteBucketId] = useState<number | null>(null);
    const [draggingBucketId, setDraggingBucketId] = useState<number | null>(null);

    const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
    const lightActive = theme === 'light';

    const loadBoard = useCallback(async () => {
        const data = await fetchCXPlannerBoardData();
        setItems(data.items);
        setManagerOptions(data.managers);
        setBuckets(data.buckets);
        setUsers(data.users);
    }, []);

    useEffect(() => {
        (async () => {
            await loadBoard();
            setIsLoading(false);
        })();
    }, [loadBoard]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') {
                setThemeState(saved);
                applyBodyTheme(saved);
            }
        } catch {
            // localStorage indisponível — segue no padrão escuro.
        }
    }, []);

    const toggleTheme = () => {
        setThemeState((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // idem — só não persiste.
            }
            applyBodyTheme(next);
            return next;
        });
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await loadBoard();
        } finally {
            setIsRefreshing(false);
        }
    };

    const openCreate = (bucketId: number | null) => {
        setEditingItem(null);
        setDefaultBucketForNew(bucketId);
        setModalOpen(true);
    };

    const openEdit = (item: CXBoardItem) => {
        setEditingItem(item);
        setModalOpen(true);
    };

    const handleSave = async (values: CXPlannerFormValues) => {
        if (editingItem) {
            const updated = await updateCXPlannerItem(editingItem.id!, values);
            if (!updated) throw new Error('Não foi possível salvar: gerente ou item não encontrado.');
            setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
        } else {
            const created = await createCXPlannerItem(values);
            if (!created) throw new Error('Não foi possível criar o item: gerente não encontrado.');
            setItems((prev) => [created, ...prev]);
        }
    };

    const handleDelete = async () => {
        if (!editingItem) return;
        await deleteCXPlannerItem(editingItem.id!);
        setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
    };

    const handleDrop = async (col: ColumnKey, e: React.DragEvent) => {
        e.preventDefault();
        setDragOverCol(null);

        // Reordenar coluna: o cabeçalho arrastado carrega o id do bucket.
        const draggedBucketStr = e.dataTransfer.getData('application/x-bucket-id');
        if (draggedBucketStr) {
            setDraggingBucketId(null);
            if (col === ENTRADA) return; // soltar na "Entrada" não reordena
            const draggedId = Number(draggedBucketStr);
            const targetId = col as number;
            if (draggedId === targetId) return;
            const ids = buckets.map((b) => b.id);
            const from = ids.indexOf(draggedId);
            const to = ids.indexOf(targetId);
            if (from === -1 || to === -1) return;
            const next = [...buckets];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            const reordered = next.map((b, i) => ({ ...b, position: i }));
            setBuckets(reordered);
            await reorderBucketsAction(reordered.map((b) => b.id));
            return;
        }

        const id = Number(e.dataTransfer.getData('text/plain'));
        if (!id) return;
        const previous = items.find((i) => i.id === id);
        if (!previous) return;
        const newBucketId = col === ENTRADA ? null : col;
        if ((previous.bucketId ?? null) === newBucketId) return;

        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, bucketId: newBucketId } : i)));
        const result = await moveCXPlannerItem(id, newBucketId);
        if (!result) {
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, bucketId: previous.bucketId ?? null } : i)));
        } else {
            setItems((prev) => prev.map((i) => (i.id === id ? result : i)));
        }
    };

    // ── Bucket management ────────────────────────────────────────────────
    const submitNewBucket = async () => {
        const name = newBucketName.trim();
        setNewBucketMode(false);
        setNewBucketName('');
        if (!name) return;
        const created = await createBucketAction(name);
        setBuckets((prev) => [...prev, created]);
    };

    const submitRename = async (id: number) => {
        const name = renameValue.trim();
        setRenamingBucketId(null);
        if (!name) return;
        setBuckets((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
        await renameBucketAction(id, name);
    };

    const handleMoveBucket = async (id: number, direction: 'left' | 'right') => {
        setMenuBucketId(null);
        await moveBucketAction(id, direction);
        await loadBoard();
    };

    const handleDeleteBucket = async (id: number) => {
        setMenuBucketId(null);
        setConfirmDeleteBucketId(null);
        await deleteBucketAction(id);
        // itens do bucket voltam pra "Entrada" (bucketId null)
        setItems((prev) => prev.map((i) => (i.bucketId === id ? { ...i, bucketId: null } : i)));
        setBuckets((prev) => prev.filter((b) => b.id !== id));
    };

    // ── Filtros ─────────────────────────────────────────────────────────
    const clienteOptions = useMemo(
        () => Array.from(new Set(items.map((i) => i.cliente).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [items]
    );

    const subtituloSuggestions = useMemo(
        () => Array.from(new Set(items.map((i) => i.subtitulo).filter((s): s is string => !!s && s.trim() !== ''))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [items]
    );

    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((item) => {
            if (managerFilter && item.managerId !== managerFilter) return false;
            if (clienteFilter && item.cliente !== clienteFilter) return false;
            if (bucketFilter === ENTRADA && item.bucketId != null) return false;
            if (bucketFilter && bucketFilter !== ENTRADA && String(item.bucketId) !== bucketFilter) return false;
            if (responsavelFilter === 'none' && item.responsavelId != null) return false;
            if (responsavelFilter && responsavelFilter !== 'none' && String(item.responsavelId) !== responsavelFilter) return false;
            if (prioridadeFilter && item.prioridadeTexto !== prioridadeFilter) return false;

            if (!q) return true;
            const haystack = [
                item.managerName, item.cliente, item.titulo, item.problema, item.solucaoProposta,
                item.subtitulo, item.responsavelName, item.prioridadeTexto, item.dataInicio, item.dataFim,
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [items, query, managerFilter, clienteFilter, bucketFilter, responsavelFilter, prioridadeFilter]);

    const hasActiveFilter = Boolean(query || managerFilter || clienteFilter || bucketFilter || responsavelFilter || prioridadeFilter);
    const clearFilters = () => {
        setQuery('');
        setManagerFilter('');
        setClienteFilter('');
        setBucketFilter('');
        setResponsavelFilter('');
        setPrioridadeFilter('');
    };

    const userUsageCount = useMemo(() => {
        const counts: Record<number, number> = {};
        for (const i of items) {
            if (i.responsavelId != null) counts[i.responsavelId] = (counts[i.responsavelId] ?? 0) + 1;
        }
        return counts;
    }, [items]);

    // Colunas: "Entrada" só aparece se houver item sem bucket; depois os buckets por position.
    const hasEntrada = items.some((i) => i.bucketId == null);
    const columns: { key: ColumnKey; label: string; bucket?: CXBucket }[] = [
        ...(hasEntrada ? [{ key: ENTRADA as ColumnKey, label: 'Entrada' }] : []),
        ...buckets.map((b) => ({ key: b.id as ColumnKey, label: b.name, bucket: b })),
    ];

    const downloadExcel = () => {
        let key = '';
        try {
            key = localStorage.getItem('CX_PLANNER_KEY') ?? '';
        } catch {
            key = '';
        }
        window.open(`/settings/cx-planner/export?key=${encodeURIComponent(key)}`, '_blank');
    };

    const T = {
        page: lightActive ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-50',
        subtitle: 'text-zinc-500',
        toolBtn: lightActive
            ? 'text-zinc-600 border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900'
            : 'text-zinc-300 border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:text-zinc-100',
        filterPanel: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-zinc-800',
        searchIcon: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        searchInput: lightActive
            ? 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            : 'bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600',
        countText: 'text-zinc-500',
        countStrong: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        clearBtn: lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
        select: lightActive ? 'bg-white border-zinc-200 text-zinc-700' : 'bg-zinc-950 border-zinc-800 text-zinc-300',
        columnBg: lightActive ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/30',
        columnDragOver: lightActive ? 'border-indigo-400 bg-indigo-50' : 'border-indigo-500/60 bg-indigo-500/5',
        columnHeadText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        addBtn: lightActive ? 'text-zinc-400 hover:text-indigo-600' : 'text-zinc-500 hover:text-indigo-400',
        emptyState: lightActive ? 'text-zinc-400' : 'text-zinc-700',
        menu: lightActive ? 'bg-white border-zinc-200 text-zinc-700' : 'bg-zinc-900 border-zinc-800 text-zinc-200',
        menuItem: lightActive ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800',
        renameInput: lightActive ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-700 text-zinc-100',
        newBucketCol: lightActive ? 'border-zinc-300 text-zinc-500 hover:border-indigo-400 hover:text-indigo-600' : 'border-zinc-800 text-zinc-500 hover:border-indigo-500/60 hover:text-indigo-400',
    };

    const selectClassName = `border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors ${T.select}`;

    if (isLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${T.page}`}>
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen p-6 transition-colors duration-200 ${T.page}`}>
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">CX Planner</h1>
                    <p className={`text-sm ${T.subtitle}`}>Board de CX do time — arraste os cards entre os buckets ou clique para editar.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={toggleTheme} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${T.toolBtn}`}>
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => setUsersModalOpen(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${T.toolBtn}`}>
                        <Users className="w-3.5 h-3.5" /> Responsáveis
                    </button>
                    <button type="button" onClick={downloadExcel} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${T.toolBtn}`}>
                        <Download className="w-3.5 h-3.5" /> Baixar Excel
                    </button>
                    <button type="button" onClick={handleRefresh} disabled={isRefreshing} title="Buscar estado mais recente" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${T.toolBtn}`}>
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                </div>
            </div>

            <div className={`mb-4 flex flex-col gap-3 p-3 rounded-xl border transition-colors duration-200 ${T.filterPanel}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${T.searchIcon}`} />
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, descrição, subtítulo, responsável ou data..." className={`w-full border rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors ${T.searchInput}`} />
                    </div>
                    <div className={`text-xs whitespace-nowrap ${T.countText}`}>
                        Mostrando <span className={`font-semibold ${T.countStrong}`}>{filteredItems.length}</span> de {items.length}
                    </div>
                    {hasActiveFilter && (
                        <button type="button" onClick={clearFilters} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors shrink-0 ${T.clearBtn}`}>
                            <X className="w-3 h-3" /> Limpar filtros
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os gerentes</option>
                        {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os clientes</option>
                        {clienteOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os buckets</option>
                        <option value={ENTRADA}>Entrada (sem bucket)</option>
                        {buckets.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                    </select>
                    <select value={responsavelFilter} onChange={(e) => setResponsavelFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os responsáveis</option>
                        <option value="none">Sem responsável</option>
                        {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                    </select>
                    <select value={prioridadeFilter} onChange={(e) => setPrioridadeFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todas as prioridades</option>
                        {PRIORIDADE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <div className="ml-auto">
                        {newBucketMode ? (
                            <input
                                autoFocus
                                value={newBucketName}
                                onChange={(e) => setNewBucketName(e.target.value)}
                                onBlur={submitNewBucket}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitNewBucket(); if (e.key === 'Escape') { setNewBucketMode(false); setNewBucketName(''); } }}
                                placeholder="Nome do bucket + Enter"
                                className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border focus:outline-none w-48 ${T.renameInput}`}
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setNewBucketMode(true)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${T.toolBtn}`}
                            >
                                <Plus className="w-3.5 h-3.5" /> Novo bucket
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 items-start">
                {columns.map((col) => {
                    const colItems = filteredItems.filter((i) => (col.key === ENTRADA ? i.bucketId == null : i.bucketId === col.key));
                    const isRenaming = col.bucket && renamingBucketId === col.bucket.id;
                    const idx = col.bucket ? buckets.findIndex((b) => b.id === col.bucket!.id) : -1;
                    return (
                        <div
                            key={String(col.key)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                            onDragLeave={() => setDragOverCol((s) => (s === col.key ? null : s))}
                            onDrop={(e) => handleDrop(col.key, e)}
                            className={`rounded-xl border p-3 flex flex-col gap-3 min-h-[200px] w-[300px] shrink-0 transition-colors ${dragOverCol === col.key ? T.columnDragOver : T.columnBg}`}
                        >
                            <div
                                className={`flex items-center justify-between gap-2 relative ${draggingBucketId === (col.bucket?.id ?? -1) ? 'opacity-40' : ''}`}
                                draggable={Boolean(col.bucket) && !isRenaming}
                                onDragStart={(e) => {
                                    if (!col.bucket) return;
                                    e.dataTransfer.setData('application/x-bucket-id', String(col.bucket.id));
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggingBucketId(col.bucket.id);
                                }}
                                onDragEnd={() => setDraggingBucketId(null)}
                            >
                                {isRenaming ? (
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => submitRename(col.bucket!.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') submitRename(col.bucket!.id); if (e.key === 'Escape') setRenamingBucketId(null); }}
                                        className={`flex-1 text-xs font-bold rounded px-2 py-1 border focus:outline-none ${T.renameInput}`}
                                    />
                                ) : (
                                    <h2 className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider truncate ${T.columnHeadText} ${col.bucket ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                                        {col.bucket && <GripVertical className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                                        <span className="truncate">{col.label} ({colItems.length})</span>
                                    </h2>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button type="button" onClick={() => openCreate(col.key === ENTRADA ? null : (col.key as number))} className={`transition-colors ${T.addBtn}`} title="Nova tarefa">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    {col.bucket && (
                                        <button type="button" onClick={() => setMenuBucketId((v) => (v === col.bucket!.id ? null : col.bucket!.id))} className={`transition-colors ${T.addBtn}`} title="Opções do bucket">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {col.bucket && menuBucketId === col.bucket.id && (
                                    <div className={`absolute right-0 top-7 z-10 w-40 rounded-lg border shadow-lg text-xs overflow-hidden ${T.menu}`}>
                                        {confirmDeleteBucketId === col.bucket.id ? (
                                            <button type="button" onClick={() => handleDeleteBucket(col.bucket!.id)} className={`w-full text-left px-3 py-2 text-red-500 flex items-center gap-2 ${T.menuItem}`}>
                                                <Check className="w-3.5 h-3.5" /> Confirmar exclusão
                                            </button>
                                        ) : (
                                            <>
                                                <button type="button" onClick={() => { setRenamingBucketId(col.bucket!.id); setRenameValue(col.bucket!.name); setMenuBucketId(null); }} className={`w-full text-left px-3 py-2 flex items-center gap-2 ${T.menuItem}`}>
                                                    <Pencil className="w-3.5 h-3.5" /> Renomear
                                                </button>
                                                <button type="button" disabled={idx <= 0} onClick={() => handleMoveBucket(col.bucket!.id, 'left')} className={`w-full text-left px-3 py-2 flex items-center gap-2 disabled:opacity-40 ${T.menuItem}`}>
                                                    <ChevronLeft className="w-3.5 h-3.5" /> Mover para esquerda
                                                </button>
                                                <button type="button" disabled={idx >= buckets.length - 1} onClick={() => handleMoveBucket(col.bucket!.id, 'right')} className={`w-full text-left px-3 py-2 flex items-center gap-2 disabled:opacity-40 ${T.menuItem}`}>
                                                    <ChevronRight className="w-3.5 h-3.5" /> Mover para direita
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteBucketId(col.bucket!.id)} className={`w-full text-left px-3 py-2 text-red-500 flex items-center gap-2 ${T.menuItem}`}>
                                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                {colItems.map((item) => (
                                    <div key={item.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(item.id))}>
                                        <CXPlannerCard item={item} onClick={() => openEdit(item)} lightActive={lightActive} />
                                    </div>
                                ))}
                                {colItems.length === 0 && (
                                    <p className={`text-xs text-center py-6 ${T.emptyState}`}>
                                        {hasActiveFilter ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="w-[220px] shrink-0">
                    {newBucketMode ? (
                        <input
                            autoFocus
                            value={newBucketName}
                            onChange={(e) => setNewBucketName(e.target.value)}
                            onBlur={submitNewBucket}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitNewBucket(); if (e.key === 'Escape') { setNewBucketMode(false); setNewBucketName(''); } }}
                            placeholder="Nome do bucket"
                            className={`w-full text-xs font-bold rounded-lg px-3 py-2 border focus:outline-none ${T.renameInput}`}
                        />
                    ) : (
                        <button type="button" onClick={() => setNewBucketMode(true)} className={`w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-xs font-semibold transition-colors ${T.newBucketCol}`}>
                            <Plus className="w-4 h-4" /> Adicionar bucket
                        </button>
                    )}
                </div>
            </div>

            <CXPlannerItemModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                item={editingItem}
                managerOptions={managerOptions}
                bucketOptions={buckets.map((b) => ({ id: b.id, name: b.name }))}
                userOptions={users.map((u) => ({ id: u.id, name: u.name }))}
                subtituloSuggestions={subtituloSuggestions}
                defaultManagerId={managerOptions[0]?.id}
                defaultBucketId={defaultBucketForNew}
                onSave={handleSave}
                onDelete={editingItem ? handleDelete : undefined}
                lightActive={lightActive}
            />

            <CXUsersModal
                open={usersModalOpen}
                onOpenChange={setUsersModalOpen}
                users={users}
                usageCount={userUsageCount}
                onChanged={loadBoard}
                lightActive={lightActive}
            />
        </div>
    );
}
