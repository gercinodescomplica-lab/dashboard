'use client';

import { Visit } from '@/types/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, MapPin, Calendar } from 'lucide-react';

interface VisitsEditorProps {
    items: Visit[];
    onChange: (items: Visit[]) => void;
}

const EMPTY_VISIT = (): Visit => ({
    titulo: '',
    local: '',
    motivo: '',
    data: new Date().toISOString().split('T')[0],
});

export function VisitsEditor({ items, onChange }: VisitsEditorProps) {
    const update = (i: number, field: keyof Visit, value: any) => {
        onChange(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
    };

    const add = () => onChange([EMPTY_VISIT(), ...items]);

    const remove = (i: number) => {
        onChange(items.filter((_, idx) => idx !== i));
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-zinc-500">Visitas realizadas por este gerente.</p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-700 text-zinc-400 hover:text-white"
                        onClick={add}
                    >
                        <Plus className="w-4 h-4 mr-1" /> Nova Visita
                    </Button>
                </div>
            </div>

            {items.length === 0 && (
                <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                    Nenhuma visita registrada. Clique em <strong className="text-zinc-500">Nova Visita</strong> para adicionar.
                </div>
            )}

            <div className="flex flex-col gap-3">
                {items.map((item, i) => {
                    return (
                        <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{item.data ? new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                                    onClick={() => remove(i)}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-zinc-400">Título da Visita</Label>
                                    <Input
                                        value={item.titulo}
                                        onChange={(e) => update(i, 'titulo', e.target.value)}
                                        placeholder="Ex: Reunião de alinhamento"
                                        className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-zinc-400">Data</Label>
                                    <Input
                                        type="date"
                                        value={item.data}
                                        onChange={(e) => update(i, 'data', e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-zinc-400 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Local</Label>
                                <Input
                                    value={item.local}
                                    onChange={(e) => update(i, 'local', e.target.value)}
                                    placeholder="Ex: Prefeitura de São Paulo"
                                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-zinc-400">Motivo / Pauta</Label>
                                <Input
                                    value={item.motivo}
                                    onChange={(e) => update(i, 'motivo', e.target.value)}
                                    placeholder="Ex: Apresentação de proposta"
                                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
