'use client';

import { useState, useEffect, useMemo } from 'react';
import { getStoreProducts, saveStoreProduct, deleteStoreProduct, getDropdownOptions, addDropdownOption } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, X } from 'lucide-react';

const ADD_NEW = '__ADD_NEW__';

function AddOptionModal({
    labelFor,
    onCancel,
    onConfirm,
}: {
    labelFor: string;
    onCancel: () => void;
    onConfirm: (v: string) => void;
}) {
    const [value, setValue] = useState('');

    const submit = () => {
        const v = value.trim();
        if (!v) return;
        onConfirm(v);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onCancel}
        >
            <div
                className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="mb-1 text-[10px] font-bold text-indigo-400 tracking-wider uppercase">Nova opção</div>
                <h2 className="text-xl font-black text-white mb-1">Adicionar {labelFor}</h2>
                <p className="text-sm text-zinc-400 mb-5">Esse valor passa a ficar disponível para outros produtos.</p>

                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">
                    {labelFor}
                </label>
                <Input
                    autoFocus
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') submit();
                        if (e.key === 'Escape') onCancel();
                    }}
                    placeholder={`Digite o nome do(a) ${labelFor.toLowerCase()}`}
                    className="bg-zinc-900 border-zinc-800 text-white h-10"
                />

                <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-zinc-800">
                    <Button
                        onClick={onCancel}
                        className="bg-transparent border border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:text-white h-9"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={!value.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Adicionar
                    </Button>
                </div>
            </div>
        </div>
    );
}

const DEFAULT_DIRETORIAS = ['DDS', 'DIT', 'DRM', 'PRE'];
const DEFAULT_STATUS: { v: string; l: string }[] = [
    { v: 'store', l: 'Na Store' },
    { v: 'breve', l: 'Em breve' },
    { v: 'backlog', l: 'Backlog' },
];

function AddableSelect({
    value,
    options,
    onChange,
    onAdd,
    labelFor,
}: {
    value: string;
    options: { v: string; l: string }[];
    onChange: (v: string) => void;
    onAdd?: (v: string) => void | Promise<void>;
    labelFor: string;
}) {
    const [modalOpen, setModalOpen] = useState(false);

    const handle = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        if (v === ADD_NEW) {
            setModalOpen(true);
            return;
        }
        onChange(v);
    };

    const hasCurrent = options.some(o => o.v === value);

    return (
        <>
            <select
                value={value}
                onChange={handle}
                className="w-full h-9 bg-zinc-950 border border-zinc-800 text-white rounded-md px-2 text-sm outline-none"
            >
                {!hasCurrent && value && <option value={value}>{value}</option>}
                {options.map(o => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                ))}
                <option value={ADD_NEW}>+ Adicionar novo…</option>
            </select>
            {modalOpen && (
                <AddOptionModal
                    labelFor={labelFor}
                    onCancel={() => setModalOpen(false)}
                    onConfirm={async v => {
                        if (onAdd) await onAdd(v);
                        onChange(v);
                        setModalOpen(false);
                    }}
                />
            )}
        </>
    );
}

export function PipelineAdmin() {
    const [products, setProducts] = useState<any[]>([]);
    const [customOptions, setCustomOptions] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);

    const loadAll = async () => {
        setLoading(true);
        const [data, opts] = await Promise.all([getStoreProducts(), getDropdownOptions()]);
        setProducts(data);
        setCustomOptions(opts);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);

    const handleAddOption = async (field: string, value: string) => {
        await addDropdownOption(field, value);
        setCustomOptions(prev => ({
            ...prev,
            [field]: Array.from(new Set([...(prev[field] ?? []), value])),
        }));
    };

    const diretoriaOptions = useMemo(() => {
        const set = new Set<string>(DEFAULT_DIRETORIAS);
        (customOptions.diretoria ?? []).forEach(v => set.add(v));
        products.forEach(p => p.d && set.add(p.d));
        return Array.from(set).map(v => ({ v, l: v }));
    }, [products, customOptions]);

    const statusOptions = useMemo(() => {
        const set = new Set<string>(DEFAULT_STATUS.map(s => s.v));
        (customOptions.status ?? []).forEach(v => set.add(v));
        products.forEach(p => p.s && set.add(p.s));
        return Array.from(set).map(v => {
            const def = DEFAULT_STATUS.find(s => s.v === v);
            return { v, l: def ? def.l : v };
        });
    }, [products, customOptions]);

    const handleAdd = () => {
        setProducts([{
            isNew: true,
            n: 'Novo Produto',
            d: 'DDS',
            s: 'backlog',
            f: '—',
            mkt: false,
            cat: 'Geral',
            r: '',
            id: Date.now()
        }, ...products]);
    };

    const handleUpdate = (index: number, field: string, val: any) => {
        const newArr = [...products];
        newArr[index] = { ...newArr[index], [field]: val };
        setProducts(newArr);
    };

    const handleSave = async (index: number) => {
        const p = products[index];
        await saveStoreProduct({
            id: p.isNew ? undefined : p.id,
            name: p.n,
            directorate: p.d,
            status: p.s,
            phase: p.f,
            marketplace: p.mkt,
            category: p.cat,
            responsavel: p.r ?? '',
        });
        await loadAll();
    };

    const handleDelete = async (index: number) => {
        const p = products[index];
        if (p.isNew) {
            const newArr = [...products];
            newArr.splice(index, 1);
            setProducts(newArr);
            return;
        }
        if (confirm(`Tem certeza que deseja deletar "${p.n}"?`)) {
            await deleteStoreProduct(p.id);
            await loadAll();
        }
    };

    if (loading) return <div className="p-8 text-white">Carregando produtos...</div>;

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-bold text-white">Pipeline Store Admin</h1>
                    <p className="text-zinc-400">Gerencie os produtos da pipeline</p>
                </div>
                <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-5 h-5 mr-2" />
                    Novo Produto
                </Button>
            </div>

            <div className="space-y-4">
                {products.length === 0 ? (
                    <div className="text-center p-12 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl text-zinc-500">Nenhum produto cadastrado.</div>
                ) : products.map((p, i) => (
                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center group">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full">
                            <div className="md:col-span-3">
                                <label className="text-xs text-zinc-500 uppercase">Nome do Produto</label>
                                <Input value={p.n} onChange={e => handleUpdate(i, 'n', e.target.value)} className="bg-zinc-950 border-zinc-800 text-white h-9" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-zinc-500 uppercase">Diretoria</label>
                                <AddableSelect
                                    value={p.d}
                                    options={diretoriaOptions}
                                    onChange={v => handleUpdate(i, 'd', v)}
                                    onAdd={v => handleAddOption('diretoria', v)}
                                    labelFor="Diretoria"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-zinc-500 uppercase">Status</label>
                                <AddableSelect
                                    value={p.s}
                                    options={statusOptions}
                                    onChange={v => handleUpdate(i, 's', v)}
                                    onAdd={v => handleAddOption('status', v)}
                                    labelFor="Status"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-zinc-500 uppercase">Fase</label>
                                <Input value={p.f} onChange={e => handleUpdate(i, 'f', e.target.value)} className="bg-zinc-950 border-zinc-800 text-white h-9" placeholder="Nov 2025 ou —" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-zinc-500 uppercase">Categoria</label>
                                <Input value={p.cat} onChange={e => handleUpdate(i, 'cat', e.target.value)} className="bg-zinc-950 border-zinc-800 text-white h-9" />
                            </div>
                            <div className="md:col-span-1 flex flex-col items-center justify-center">
                                <label className="text-xs text-zinc-500 uppercase mb-2">MKT</label>
                                <input type="checkbox" checked={p.mkt} onChange={e => handleUpdate(i, 'mkt', e.target.checked)} className="w-5 h-5 accent-indigo-500" />
                            </div>
                            <div className="md:col-span-12">
                                <label className="text-xs text-zinc-500 uppercase">Pessoa Responsável</label>
                                <Input value={p.r ?? ''} onChange={e => handleUpdate(i, 'r', e.target.value)} className="bg-zinc-950 border-zinc-800 text-white h-9" placeholder="Nome da pessoa responsável" />
                            </div>
                        </div>
                        <div className="flex gap-2 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-4 w-full md:w-auto mt-2 md:mt-0">
                            <Button size="sm" onClick={() => handleSave(i)} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20 h-9">
                                <Save className="w-4 h-4 mr-1" /> Salvar
                            </Button>
                            <Button size="sm" onClick={() => handleDelete(i)} variant="destructive" className="bg-red-950/50 text-red-400 hover:bg-red-900/50 border border-red-900/50 h-9 px-3">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
