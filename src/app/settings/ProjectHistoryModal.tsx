'use client';

import React, { useState, useEffect } from 'react';
import { Project, ProjectHistoryItem, HistoryChangeType, OpportunityTemperature } from '@/types/manager';
import { X, History, Plus, Trash2, DollarSign, Calendar, Sparkles, Tag, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';

interface ProjectHistoryModalProps {
    open: boolean;
    onClose: () => void;
    project: Project | null;
    quarterKey?: string;
    onSaveHistory: (newHistory: ProjectHistoryItem[]) => void;
}

const TEMP_LABELS: Record<OpportunityTemperature, string> = {
    quente: '🔥 Quente',
    morno: '🟡 Morno',
    frio: '❄️ Frio',
    contratado: '✅ Contratado',
    historico: '⏸️ Adiado/Histórico',
    perdido: '❌ Perdido',
};

const QUARTER_LABELS: Record<string, string> = {
    q1: 'Q1',
    q2: 'Q2',
    q3: 'Q3',
    q4: 'Q4',
    nao_mapeado: 'Não Mapeado',
};

function getHistoryIcon(type: HistoryChangeType) {
    switch (type) {
        case 'valor':
            return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
        case 'quarter':
            return <Calendar className="w-3.5 h-3.5 text-indigo-400" />;
        case 'status':
            return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
        default:
            return <Tag className="w-3.5 h-3.5 text-zinc-400" />;
    }
}

export function ProjectHistoryModal({
    open,
    onClose,
    project,
    quarterKey,
    onSaveHistory,
}: ProjectHistoryModalProps) {
    const [historyList, setHistoryList] = useState<ProjectHistoryItem[]>([]);

    // Form state for adding new entry
    const [tipo, setTipo] = useState<HistoryChangeType>('valor');
    const [date, setDate] = useState<string>('');
    const [autor, setAutor] = useState<string>('');
    const [deValor, setDeValor] = useState<string>('');
    const [paraValor, setParaValor] = useState<string>('');
    const [deStatus, setDeStatus] = useState<string>('');
    const [paraStatus, setParaStatus] = useState<string>('');
    const [deQuarter, setDeQuarter] = useState<string>('');
    const [paraQuarter, setParaQuarter] = useState<string>('');
    const [justificativa, setJustificativa] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (open && project) {
            setHistoryList(project.history || []);

            // Set default date to today (DD/MM/YYYY)
            const today = new Date();
            const d = String(today.getDate()).padStart(2, '0');
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const y = today.getFullYear();
            setDate(`${d}/${m}/${y}`);

            // Pre-fill defaults based on project
            setTipo('valor');
            setDeValor(project.value ? formatCurrency(project.value) : '');
            setParaValor('');
            setDeStatus(project.temperature || 'morno');
            setParaStatus(project.temperature || 'morno');
            setDeQuarter(quarterKey || 'q1');
            setParaQuarter(quarterKey || 'q1');
            setJustificativa('');
            setAutor('');
            setErrorMsg(null);
        }
    }, [open, project, quarterKey]);

    if (!open || !project) return null;

    const handleAddEntry = () => {
        setErrorMsg(null);

        let deFinal = '';
        let paraFinal = '';

        if (tipo === 'valor') {
            if (!paraValor.trim()) {
                setErrorMsg('Informe o novo valor (Para).');
                return;
            }
            deFinal = deValor.trim();
            paraFinal = paraValor.trim();
        } else if (tipo === 'status') {
            deFinal = TEMP_LABELS[deStatus as OpportunityTemperature] || deStatus;
            paraFinal = TEMP_LABELS[paraStatus as OpportunityTemperature] || paraStatus;
        } else if (tipo === 'quarter') {
            deFinal = QUARTER_LABELS[deQuarter] || deQuarter;
            paraFinal = QUARTER_LABELS[paraQuarter] || paraQuarter;
        }

        if (!date.trim()) {
            setErrorMsg('Informe a data do histórico.');
            return;
        }

        const newItem: ProjectHistoryItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            date: date.trim(),
            tipo,
            de: deFinal || undefined,
            para: paraFinal || undefined,
            justificativa: justificativa.trim() || undefined,
            autor: autor.trim() || undefined,
        };

        // Insert at beginning of timeline
        setHistoryList([newItem, ...historyList]);

        // Reset inputs
        setJustificativa('');
        setParaValor('');
    };

    const handleDeleteItem = (indexToDelete: number) => {
        setHistoryList(historyList.filter((_, idx) => idx !== indexToDelete));
    };

    const handleSaveAndClose = () => {
        onSaveHistory(historyList);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Box */}
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                                Histórico do Projeto
                                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                                    {historyList.length} registro(s)
                                </span>
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                <strong className="text-zinc-200">{project.orgao ? `${project.orgao} — ` : ''}{project.name}</strong>
                                {project.value > 0 && ` · ${formatCurrency(project.value)}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Form to Add New Entry */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> Adicionar Novo Histórico
                            </h4>
                            <span className="text-[11px] text-zinc-500">Grave alterações de valor, status ou notas</span>
                        </div>

                        {/* Form Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Tipo de Mudança</label>
                                <select
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value as HistoryChangeType)}
                                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="valor">💰 Alteração de Valor</option>
                                    <option value="status">✨ Mudança de Status/Temp</option>
                                    <option value="quarter">📅 Mudança de Quarter</option>
                                    <option value="nota">📝 Nota / Observação</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Data</label>
                                <Input
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    placeholder="DD/MM/AAAA"
                                    className="h-9 bg-zinc-950 border-zinc-800 text-xs text-zinc-200"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Autor (Opcional)</label>
                                <Input
                                    value={autor}
                                    onChange={(e) => setAutor(e.target.value)}
                                    placeholder="Ex: Lucas / Diretoria"
                                    className="h-9 bg-zinc-950 border-zinc-800 text-xs text-zinc-200"
                                />
                            </div>
                        </div>

                        {/* Conditional De / Para Inputs */}
                        {tipo === 'valor' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-zinc-400 uppercase">Valor Anterior (De)</label>
                                    <Input
                                        value={deValor}
                                        onChange={(e) => setDeValor(e.target.value)}
                                        placeholder="Ex: R$ 417.000"
                                        className="h-9 bg-zinc-950 border-zinc-800 text-xs text-zinc-200 font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-emerald-400 uppercase">Novo Valor (Para)</label>
                                    <Input
                                        value={paraValor}
                                        onChange={(e) => setParaValor(e.target.value)}
                                        placeholder="Ex: R$ 500.000"
                                        className="h-9 bg-zinc-950 border-zinc-800 text-xs text-zinc-200 font-mono"
                                    />
                                </div>
                            </div>
                        )}

                        {tipo === 'status' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-zinc-400 uppercase">Status Anterior (De)</label>
                                    <select
                                        value={deStatus}
                                        onChange={(e) => setDeStatus(e.target.value)}
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="quente">🔥 Quente</option>
                                        <option value="morno">🟡 Morno</option>
                                        <option value="frio">❄️ Frio</option>
                                        <option value="contratado">✅ Contratado</option>
                                        <option value="historico">⏸️ Adiado/Histórico</option>
                                        <option value="perdido">❌ Perdido</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-amber-400 uppercase">Novo Status (Para)</label>
                                    <select
                                        value={paraStatus}
                                        onChange={(e) => setParaStatus(e.target.value)}
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="quente">🔥 Quente</option>
                                        <option value="morno">🟡 Morno</option>
                                        <option value="frio">❄️ Frio</option>
                                        <option value="contratado">✅ Contratado</option>
                                        <option value="historico">⏸️ Adiado/Histórico</option>
                                        <option value="perdido">❌ Perdido</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {tipo === 'quarter' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-zinc-400 uppercase">Quarter Anterior (De)</label>
                                    <select
                                        value={deQuarter}
                                        onChange={(e) => setDeQuarter(e.target.value)}
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="q1">Q1</option>
                                        <option value="q2">Q2</option>
                                        <option value="q3">Q3</option>
                                        <option value="q4">Q4</option>
                                        <option value="nao_mapeado">Não Mapeado</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-indigo-400 uppercase">Novo Quarter (Para)</label>
                                    <select
                                        value={paraQuarter}
                                        onChange={(e) => setParaQuarter(e.target.value)}
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="q1">Q1</option>
                                        <option value="q2">Q2</option>
                                        <option value="q3">Q3</option>
                                        <option value="q4">Q4</option>
                                        <option value="nao_mapeado">Não Mapeado</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Justificativa / Nota */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                                Justificativa / Detalhes da Alteração
                            </label>
                            <textarea
                                value={justificativa}
                                onChange={(e) => setJustificativa(e.target.value)}
                                placeholder="Descreva o contexto da mudança (ex: Escopo reduzido após alinhamento com cliente...)"
                                rows={2}
                                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-600 resize-none"
                            />
                        </div>

                        {errorMsg && (
                            <div className="flex items-center gap-1.5 text-xs text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleAddEntry}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-4"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar Entrada
                            </Button>
                        </div>
                    </div>

                    {/* Timeline List */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                            <span>Linha do Tempo Registrada ({historyList.length})</span>
                            <span className="text-[11px] text-zinc-500 font-normal">Mais recentes primeiro</span>
                        </h4>

                        {historyList.length === 0 ? (
                            <div className="py-8 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
                                <History className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                                <p className="text-xs text-zinc-400 font-medium">Nenhum registro no histórico deste projeto.</p>
                                <p className="text-[11px] text-zinc-600 mt-0.5">Use o formulário acima para registrar alterações.</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                                {historyList.map((item, idx) => (
                                    <div
                                        key={item.id || idx}
                                        className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-start justify-between gap-3 group hover:border-zinc-700 transition-colors"
                                    >
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="flex items-center gap-1 text-xs font-semibold text-zinc-200">
                                                    {getHistoryIcon(item.tipo)}
                                                    {item.date}
                                                </span>
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                    {item.tipo}
                                                </span>
                                                {item.autor && (
                                                    <span className="text-[11px] text-zinc-500">• por {item.autor}</span>
                                                )}
                                            </div>

                                            {item.de && item.para && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-zinc-400">De: <strong className="text-zinc-200 font-medium">{item.de}</strong></span>
                                                    <span className="text-zinc-600">➔</span>
                                                    <span className="text-zinc-400">Para: <strong className="text-indigo-400 font-medium">{item.para}</strong></span>
                                                </div>
                                            )}

                                            {item.justificativa && (
                                                <p className="text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800/80 rounded-md p-2 mt-1">
                                                    {item.justificativa}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteItem(idx)}
                                            title="Excluir este registro"
                                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs h-9"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSaveAndClose}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-5 font-semibold flex items-center gap-1.5"
                    >
                        <Check className="w-4 h-4" /> Salvar Histórico
                    </Button>
                </div>
            </div>
        </div>
    );
}
