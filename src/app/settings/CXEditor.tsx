'use client';

import { CXItem, CXStatus } from '@/types/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

interface CXEditorProps {
    items: CXItem[];
    onChange: (items: CXItem[]) => void;
}

const STATUS_OPTIONS: { value: CXStatus; label: string; color: string }[] = [
    { value: 'pendente', label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { value: 'analise', label: 'Em Análise', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'resolvido', label: 'Resolvido', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
];

const EMPTY_ITEM = (): CXItem => ({
    cliente: '',
    titulo: '',
    problema: '',
    solucaoProposta: '',
    status: 'pendente',
});

export function CXEditor({ items, onChange }: CXEditorProps) {
    const update = (i: number, field: keyof CXItem, value: any) => {
        onChange(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
    };

    const add = () => onChange([...items, EMPTY_ITEM()]);
    const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-zinc-500">Registros de CX atrelados a este gerente.</p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-700 text-zinc-400 hover:text-white"
                        onClick={add}
                    >
                        <Plus className="w-4 h-4 mr-1" /> Novo CX
                    </Button>
                </div>
            </div>

            {items.length === 0 && (
                <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                    Nenhum registro de CX. Clique em <strong className="text-zinc-500">Novo CX</strong> para adicionar.
                </div>
            )}

            <div className="flex flex-col gap-4">
                {items.map((item, i) => (
                    <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">CX #{i + 1}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                                onClick={() => remove(i)}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-zinc-400">Cliente / Órgão</Label>
                                <Input
                                    value={item.cliente}
                                    onChange={(e) => update(i, 'cliente', e.target.value)}
                                    placeholder="Ex: SEFAZ"
                                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-zinc-400">Status</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {STATUS_OPTIONS.map((s) => (
                                        <button
                                            key={s.value}
                                            type="button"
                                            onClick={() => update(i, 'status', s.value)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${item.status === s.value
                                                ? s.color + ' ring-2 ring-offset-1 ring-offset-zinc-950 ring-current'
                                                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                                                }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Título do Problema</Label>
                            <Input
                                value={item.titulo}
                                onChange={(e) => update(i, 'titulo', e.target.value)}
                                placeholder="Resumo do problema"
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Descrição do Problema</Label>
                            <Input
                                value={item.problema}
                                onChange={(e) => update(i, 'problema', e.target.value)}
                                placeholder="Descreva o problema relatado em detalhes"
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Solução Proposta</Label>
                            <Input
                                value={item.solucaoProposta}
                                onChange={(e) => update(i, 'solucaoProposta', e.target.value)}
                                placeholder="Descreva a solução ou encaminhamento"
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
