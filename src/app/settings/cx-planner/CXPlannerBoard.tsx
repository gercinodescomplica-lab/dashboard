'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
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

    useEffect(() => {
        (async () => {
            const [boardItems, managers] = await Promise.all([
                fetchCXPlannerBoardItems(),
                fetchManagersForDropdown(),
            ]);
            setItems(boardItems);
            setManagerOptions(managers);
            setIsLoading(false);
        })();
    }, []);

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
            if (updated) {
                setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
            }
        } else {
            const created = await createCXPlannerItem(values);
            if (created) {
                setItems((prev) => [...prev, created]);
            }
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">CX Planner</h1>
                <p className="text-zinc-500 text-sm">Board de CX do time — arraste os cards entre as colunas ou clique para editar.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STATUS_COLUMNS.map((col) => {
                    const colItems = items.filter((i) => i.status === col.key);
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
                                    <p className="text-xs text-zinc-700 text-center py-6">Nenhum item.</p>
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
