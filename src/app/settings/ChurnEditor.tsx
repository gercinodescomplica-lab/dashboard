'use client';

import { useState } from 'react';
import { ChurnItem } from '@/types/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit3, TrendingDown, FileText, AlertCircle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';

interface ChurnEditorProps {
    items: ChurnItem[];
    onChange: (items: ChurnItem[]) => void;
}

const EMPTY_CHURN = (): ChurnItem => ({
    numeroContrato: '',
    valor: 0,
    descricao: '',
    motivo: '',
});

export function ChurnEditor({ items, onChange }: ChurnEditorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [formData, setFormData] = useState<ChurnItem>(EMPTY_CHURN());

    const openAddModal = () => {
        setEditingIndex(null);
        setFormData(EMPTY_CHURN());
        setIsModalOpen(true);
    };

    const openEditModal = (index: number) => {
        setEditingIndex(index);
        setFormData({ ...items[index] });
        setIsModalOpen(true);
    };

    const handleSaveItem = () => {
        if (!formData.numeroContrato.trim()) {
            alert('Por favor, informe o número do contrato.');
            return;
        }

        if (editingIndex !== null) {
            const updated = items.map((item, idx) => (idx === editingIndex ? formData : item));
            onChange(updated);
        } else {
            onChange([formData, ...items]);
        }
        setIsModalOpen(false);
    };

    const remove = (index: number) => {
        if (confirm('Tem certeza que deseja remover este registro de churn?')) {
            onChange(items.filter((_, idx) => idx !== index));
        }
    };

    const totalChurn = items.reduce((acc, item) => acc + (item.valor || 0), 0);

    return (
        <div className="flex flex-col gap-6">
            {/* Header / Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
                <div>
                    <h4 className="text-base font-semibold text-red-400 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5" /> Registros de Churn
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Cadastre e acompanhe os contratos rescindidos ou perdidos por este gerente.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <span className="text-xs text-zinc-500 block uppercase tracking-wider font-medium">Total Churn</span>
                        <span className="text-lg font-bold font-mono text-red-400">{formatCurrency(totalChurn)}</span>
                    </div>
                    <Button
                        type="button"
                        onClick={openAddModal}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Adicionar Churn
                    </Button>
                </div>
            </div>

            {/* Churn Items List */}
            {items.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-zinc-600" />
                    <p>Nenhum churn registrado para este gerente.</p>
                    <p className="text-xs text-zinc-600">Clique no botão &quot;Adicionar Churn&quot; acima para registrar um contrato perdido.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((item, index) => (
                        <div
                            key={index}
                            className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-red-400" />
                                        <span className="font-bold text-zinc-100 text-sm">{item.numeroContrato}</span>
                                    </div>
                                    <span className="font-mono font-bold text-red-400 text-sm">
                                        {formatCurrency(item.valor)}
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs">
                                    {item.descricao && (
                                        <div>
                                            <span className="text-zinc-500 font-semibold block">Descrição / Serviço:</span>
                                            <p className="text-zinc-300 bg-zinc-900/60 p-2 rounded border border-zinc-800/60">{item.descricao}</p>
                                        </div>
                                    )}
                                    {item.motivo && (
                                        <div>
                                            <span className="text-zinc-500 font-semibold block">Motivo da Desistência:</span>
                                            <p className="text-red-300/90 bg-red-950/20 p-2 rounded border border-red-900/30">{item.motivo}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditModal(index)}
                                    className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 px-2"
                                >
                                    <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => remove(index)}
                                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 px-2"
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for Adding / Editing Churn */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-red-400" />
                            {editingIndex !== null ? 'Editar Registro de Churn' : 'Adicionar Churn'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-zinc-300">Número do Contrato</Label>
                            <Input
                                value={formData.numeroContrato}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, numeroContrato: e.target.value })}
                                placeholder="Ex: Contrato 1234/2024"
                                className="bg-zinc-900 border-zinc-800 text-zinc-100"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-300">Valor do Churn (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.valor || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                                placeholder="Ex: 2500000"
                                className="bg-zinc-900 border-zinc-800 text-red-400 font-mono"
                            />
                            <p className="text-[11px] text-zinc-500">
                                Valor formatado: {formatCurrency(formData.valor || 0)}
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-300">Descrição do Serviço / Objeto</Label>
                            <textarea
                                value={formData.descricao}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, descricao: e.target.value })}
                                placeholder="Ex: Redes de computadores, serviço de consultoria, licenças de software..."
                                rows={3}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-300">Motivo da Desistência / Perda</Label>
                            <textarea
                                value={formData.motivo}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, motivo: e.target.value })}
                                placeholder="Ex: Encontrou preço menor no mercado, optou por solução interna, não quis renovar com a PRODAM por X, Y, Z..."
                                rows={3}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                            className="border-zinc-800 text-zinc-400 hover:text-white"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveItem}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Salvar Churn
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
