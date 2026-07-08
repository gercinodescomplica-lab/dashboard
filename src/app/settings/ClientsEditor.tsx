'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Building2 } from 'lucide-react';

interface ClientsEditorProps {
    items: string[];
    onChange: (items: string[]) => void;
}

export function ClientsEditor({ items, onChange }: ClientsEditorProps) {
    const [draft, setDraft] = useState('');

    const add = () => {
        const value = draft.trim();
        if (!value) return;
        if (items.includes(value)) {
            setDraft('');
            return;
        }
        onChange([...items, value]);
        setDraft('');
    };

    const remove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    const update = (index: number, value: string) => {
        onChange(items.map((c, i) => (i === index ? value : c)));
    };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h4 className="text-sm font-semibold text-zinc-200 mb-1">Clientes Atendidos</h4>
                <p className="text-xs text-zinc-500">
                    Uma sigla ou nome por item. Ex: <span className="text-zinc-400">SMC</span>, <span className="text-zinc-400">PGM (Procuradoria Geral do Município)</span>.
                </p>
            </div>

            <div className="flex gap-2">
                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder="Adicionar cliente e pressionar Enter"
                    className="bg-zinc-950 border-zinc-800 text-zinc-200"
                />
                <Button
                    type="button"
                    onClick={add}
                    disabled={!draft.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
            </div>

            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
                    <Building2 className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum cliente cadastrado.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {items.map((client, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg">
                            <Building2 className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-1" />
                            <Input
                                value={client}
                                onChange={(e) => update(index, e.target.value)}
                                className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-200 flex-1 h-8"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
