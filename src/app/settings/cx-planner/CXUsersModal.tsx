'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Pencil, Plus, X, Check } from 'lucide-react';
import { CXUser } from '@/db/queries';
import { createUserAction, updateUserAction, deleteUserAction } from './actions';

interface CXUsersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: CXUser[];
    usageCount: Record<number, number>;
    onChanged: () => Promise<void>;
    lightActive?: boolean;
}

export function CXUsersModal({ open, onOpenChange, users, usageCount, onChanged, lightActive = false }: CXUsersModalProps) {
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setNewName('');
            setNewEmail('');
            setEditingId(null);
            setConfirmDeleteId(null);
        }
    }, [open]);

    const T = {
        dialog: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100',
        label: lightActive ? 'text-zinc-600' : 'text-zinc-400',
        field: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-zinc-800 text-zinc-200',
        row: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        muted: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        warn: lightActive ? 'text-amber-700' : 'text-amber-400',
        iconBtn: lightActive ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-400 hover:text-white',
        danger: lightActive ? 'text-red-600 hover:text-red-500' : 'text-red-500 hover:text-red-400',
    };

    const handleAdd = async () => {
        if (!newName.trim() || busy) return;
        setBusy(true);
        try {
            await createUserAction(newName, newEmail);
            setNewName('');
            setNewEmail('');
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    const startEdit = (u: CXUser) => {
        setEditingId(u.id);
        setEditName(u.name);
        setEditEmail(u.email ?? '');
        setConfirmDeleteId(null);
    };

    const handleSaveEdit = async () => {
        if (editingId == null || !editName.trim() || busy) return;
        setBusy(true);
        try {
            await updateUserAction(editingId, editName, editEmail);
            setEditingId(null);
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (busy) return;
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            return;
        }
        setBusy(true);
        try {
            await deleteUserAction(id);
            setConfirmDeleteId(null);
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`max-w-lg transition-colors duration-200 ${T.dialog}`}>
                <DialogHeader>
                    <DialogTitle>Responsáveis do CX</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    <div className={`flex flex-col divide-y rounded-lg border ${T.row}`}>
                        {users.length === 0 && (
                            <p className={`text-xs text-center py-4 ${T.muted}`}>Nenhum responsável cadastrado.</p>
                        )}
                        {users.map((u) => {
                            const inUse = usageCount[u.id] ?? 0;
                            const isEditing = editingId === u.id;
                            return (
                                <div key={u.id} className={`flex items-center gap-2 px-3 py-2 ${T.row}`}>
                                    {isEditing ? (
                                        <>
                                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome" className={`h-8 text-xs ${T.field}`} />
                                            <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" className={`h-8 text-xs ${T.field}`} />
                                            <button type="button" onClick={handleSaveEdit} disabled={busy} className={T.iconBtn} title="Salvar"><Check className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => setEditingId(null)} className={T.iconBtn} title="Cancelar"><X className="w-4 h-4" /></button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate">{u.name}</p>
                                                {u.email && <p className={`text-[10px] truncate ${T.muted}`}>{u.email}</p>}
                                            </div>
                                            {confirmDeleteId === u.id ? (
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] ${T.warn}`}>
                                                        {inUse > 0 ? `${inUse} card(s) ficam sem responsável.` : 'Confirmar?'}
                                                    </span>
                                                    <button type="button" onClick={() => handleDelete(u.id)} disabled={busy} className={T.danger} title="Confirmar exclusão"><Check className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => setConfirmDeleteId(null)} className={T.iconBtn} title="Cancelar"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button type="button" onClick={() => startEdit(u)} className={T.iconBtn} title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button type="button" onClick={() => handleDelete(u.id)} className={T.danger} title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                            <Label className={T.label}>Novo responsável</Label>
                            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" className={`h-8 text-xs ${T.field}`} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label className={T.label}>Email (opcional)</Label>
                            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@prodam.sp.gov.br" className={`h-8 text-xs ${T.field}`} />
                        </div>
                        <Button type="button" onClick={handleAdd} disabled={busy || !newName.trim()} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
