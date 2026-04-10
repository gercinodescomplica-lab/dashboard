'use client';

import { useState, useEffect } from 'react';
import { getStoreProducts, saveStoreProduct, deleteStoreProduct } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save } from 'lucide-react';

export function PipelineAdmin() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadProducts = async () => {
        setLoading(true);
        const data = await getStoreProducts();
        setProducts(data);
        setLoading(false);
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const handleAdd = () => {
        setProducts([{
            isNew: true,
            n: 'Novo Produto',
            d: 'DDS',
            s: 'backlog',
            f: '—',
            mkt: false,
            cat: 'Geral',
            id: Date.now() // temporary ID
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
            category: p.cat
        });
        await loadProducts();
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
            await loadProducts();
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
                                <select value={p.d} onChange={e => handleUpdate(i, 'd', e.target.value)} className="w-full h-9 bg-zinc-950 border border-zinc-800 text-white rounded-md px-2 text-sm outline-none">
                                    <option value="DDS">DDS</option>
                                    <option value="DIT">DIT</option>
                                    <option value="DRM">DRM</option>
                                    <option value="PRE">PRE</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-zinc-500 uppercase">Status</label>
                                <select value={p.s} onChange={e => handleUpdate(i, 's', e.target.value)} className="w-full h-9 bg-zinc-950 border border-zinc-800 text-white rounded-md px-2 text-sm outline-none">
                                    <option value="store">Na Store</option>
                                    <option value="breve">Em breve</option>
                                    <option value="backlog">Backlog</option>
                                </select>
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
