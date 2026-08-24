'use client';

import { useState, useTransition, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { PropostaRow } from '@/db/queries';
import { createPropostaAction, updatePropostaAction } from '../actions';

interface ProposalModalProps {
    open: boolean;
    mode: 'add' | 'edit';
    proposta: PropostaRow | null;
    managersList: { id: string; name: string; role: string }[];
    gerencias: string[];
    fases: string[];
    statusOptions: string[];
    onClose: () => void;
    onSuccess: () => void;
    lightActive?: boolean;
}

function FormField({
    label,
    children,
    required,
    lightActive,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    lightActive?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1">
            <label className={`text-xs font-semibold uppercase tracking-wider ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {label}{required && <span className={`ml-0.5 ${lightActive ? 'text-rose-500' : 'text-rose-400'}`}>*</span>}
            </label>
            {children}
        </div>
    );
}

function getInputCls(lightActive: boolean) {
    return lightActive
        ? 'h-9 w-full px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all'
        : 'h-9 w-full px-3 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all';
}
function getSelectCls(lightActive: boolean) {
    return lightActive
        ? 'h-9 w-full px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none'
        : 'h-9 w-full px-3 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none';
}

export function ProposalModal({
    open,
    mode,
    proposta,
    managersList,
    gerencias,
    fases,
    statusOptions,
    onClose,
    onSuccess,
    lightActive = false,
}: ProposalModalProps) {
    const inputCls = getInputCls(lightActive);
    const selectCls = getSelectCls(lightActive);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        id: '',
        numeroProposta: '',
        nomeOportunidade: '',
        proprietario: '',
        cliente: '',
        fase: '',
        valor: '',
        receitaEsperada: '',
        probabilidade: '',
        duracao: '',
        dataCriacao: '',
        dataFechamento: '',
        gerencia: '',
        managerId: '',
        status: '',
        observacao: '',
    });

    useEffect(() => {
        if (mode === 'edit' && proposta) {
            setForm({
                id: proposta.id,
                numeroProposta: proposta.numeroProposta,
                nomeOportunidade: proposta.nomeOportunidade,
                proprietario: proposta.proprietario ?? '',
                cliente: proposta.cliente,
                fase: proposta.fase ?? '',
                valor: proposta.valor?.toString() ?? '',
                receitaEsperada: proposta.receitaEsperada?.toString() ?? '',
                probabilidade:
                    proposta.probabilidade !== null && proposta.probabilidade !== undefined
                        ? (proposta.probabilidade * 100).toString()
                        : '',
                duracao: proposta.duracao?.toString() ?? '',
                dataCriacao: proposta.dataCriacao ?? '',
                dataFechamento: proposta.dataFechamento ?? '',
                gerencia: proposta.gerencia ?? '',
                managerId: proposta.managerId ?? '',
                status: proposta.status ?? '',
                observacao: proposta.observacao ?? '',
            });
        } else if (mode === 'add') {
            setForm({
                id: '',
                numeroProposta: '',
                nomeOportunidade: '',
                proprietario: '',
                cliente: '',
                fase: 'Elaboração de proposta',
                valor: '',
                receitaEsperada: '',
                probabilidade: '',
                duracao: '',
                dataCriacao: '',
                dataFechamento: '',
                gerencia: '',
                managerId: '',
                status: '',
                observacao: '',
            });
        }
        setError(null);
    }, [mode, proposta, open]);

    if (!open) return null;

    function set(field: string, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const probAsFraction = form.probabilidade
            ? parseFloat(form.probabilidade) / 100
            : null;

        const payload = {
            id: form.id || crypto.randomUUID(),
            numeroProposta: form.numeroProposta.trim(),
            nomeOportunidade: form.nomeOportunidade.trim(),
            proprietario: form.proprietario.trim() || null,
            cliente: form.cliente.trim(),
            fase: form.fase || null,
            valor: form.valor ? parseFloat(form.valor) : null,
            receitaEsperada: form.receitaEsperada ? parseFloat(form.receitaEsperada) : null,
            probabilidade: probAsFraction,
            duracao: form.duracao ? parseInt(form.duracao, 10) : null,
            dataCriacao: form.dataCriacao || null,
            dataFechamento: form.dataFechamento || null,
            gerencia: form.gerencia || null,
            managerId: form.managerId || null,
            status: form.status || null,
            observacao: form.observacao.trim() || null,
        };

        startTransition(async () => {
            const result =
                mode === 'add'
                    ? await createPropostaAction(payload)
                    : await updatePropostaAction(payload.id, payload);

            if (result.success) {
                onSuccess();
            } else {
                setError(result.error);
            }
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col border rounded-2xl shadow-2xl overflow-hidden mx-4 ${lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-800'}`}>
                <div className={`flex items-center justify-between px-6 py-4 border-b flex-none ${lightActive ? 'border-zinc-200' : 'border-zinc-800'}`}>
                    <div>
                        <h2 className={`text-lg font-bold ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>
                            {mode === 'add' ? 'Nova Proposta' : 'Editar Proposta'}
                        </h2>
                        {mode === 'edit' && proposta && (
                            <p className={`text-xs mt-0.5 font-mono ${lightActive ? 'text-zinc-500' : 'text-zinc-500'}`}>{proposta.numeroProposta}</p>
                        )}
                    </div>
                    <button
                        id="proposal-modal-close"
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form id="proposal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 grid grid-cols-2 gap-4">
                        <FormField label="Número da Proposta" required lightActive={lightActive}>
                            <input
                                id="field-numeroProposta"
                                className={inputCls}
                                value={form.numeroProposta}
                                onChange={(e) => set('numeroProposta', e.target.value)}
                                placeholder="Q-00000"
                                required
                                disabled={mode === 'edit'}
                            />
                        </FormField>
                        <FormField label="Fase" lightActive={lightActive}>
                            <select
                                id="field-fase"
                                className={selectCls}
                                value={form.fase}
                                onChange={(e) => set('fase', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {fases.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </FormField>

                        <div className="col-span-2">
                            <FormField label="Nome da Oportunidade" required lightActive={lightActive}>
                                <input
                                    id="field-nomeOportunidade"
                                    className={inputCls}
                                    value={form.nomeOportunidade}
                                    onChange={(e) => set('nomeOportunidade', e.target.value)}
                                    placeholder="Ex: Microsoft Power Platform + Tokens ChatGPT"
                                    required
                                />
                            </FormField>
                        </div>

                        <div className="col-span-2">
                            <FormField label="Cliente" required lightActive={lightActive}>
                                <input
                                    id="field-cliente"
                                    className={inputCls}
                                    value={form.cliente}
                                    onChange={(e) => set('cliente', e.target.value)}
                                    placeholder="Nome do órgão/cliente"
                                    required
                                />
                            </FormField>
                        </div>

                        <FormField label="Gerência (GRC)" lightActive={lightActive}>
                            <select
                                id="field-gerencia"
                                className={selectCls}
                                value={form.gerencia}
                                onChange={(e) => set('gerencia', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {gerencias.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Gerente (Manager)" lightActive={lightActive}>
                            <select
                                id="field-managerId"
                                className={selectCls}
                                value={form.managerId}
                                onChange={(e) => set('managerId', e.target.value)}
                            >
                                <option value="">Nenhum</option>
                                {managersList.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                                ))}
                            </select>
                        </FormField>

                        <div className="col-span-2">
                            <FormField label="Proprietário da Oportunidade" lightActive={lightActive}>
                                <input
                                    id="field-proprietario"
                                    className={inputCls}
                                    value={form.proprietario}
                                    onChange={(e) => set('proprietario', e.target.value)}
                                    placeholder="Nome do proprietário"
                                />
                            </FormField>
                        </div>

                        <FormField label="Valor (R$)" lightActive={lightActive}>
                            <input
                                id="field-valor"
                                type="number"
                                step="0.01"
                                className={inputCls}
                                value={form.valor}
                                onChange={(e) => set('valor', e.target.value)}
                                placeholder="0.00"
                            />
                        </FormField>
                        <FormField label="Receita Esperada (R$)" lightActive={lightActive}>
                            <input
                                id="field-receitaEsperada"
                                type="number"
                                step="0.01"
                                className={inputCls}
                                value={form.receitaEsperada}
                                onChange={(e) => set('receitaEsperada', e.target.value)}
                                placeholder="0.00"
                            />
                        </FormField>

                        <FormField label="Probabilidade (%)" lightActive={lightActive}>
                            <input
                                id="field-probabilidade"
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                className={inputCls}
                                value={form.probabilidade}
                                onChange={(e) => set('probabilidade', e.target.value)}
                                placeholder="0 - 100"
                            />
                        </FormField>
                        <FormField label="Duração (dias)" lightActive={lightActive}>
                            <input
                                id="field-duracao"
                                type="number"
                                step="1"
                                className={inputCls}
                                value={form.duracao}
                                onChange={(e) => set('duracao', e.target.value)}
                                placeholder="Ex: 90"
                            />
                        </FormField>

                        <FormField label="Data de Criação" lightActive={lightActive}>
                            <input
                                id="field-dataCriacao"
                                type="date"
                                className={inputCls}
                                value={form.dataCriacao}
                                onChange={(e) => set('dataCriacao', e.target.value)}
                            />
                        </FormField>
                        <FormField label="Data de Fechamento" lightActive={lightActive}>
                            <input
                                id="field-dataFechamento"
                                type="date"
                                className={inputCls}
                                value={form.dataFechamento}
                                onChange={(e) => set('dataFechamento', e.target.value)}
                            />
                        </FormField>

                        <div className={`col-span-2 border-t pt-4 mt-2 ${lightActive ? 'border-zinc-200' : 'border-zinc-800'}`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${lightActive ? 'text-zinc-500' : 'text-zinc-500'}`}>Status do Pipeline</p>
                        </div>

                        <FormField label="Status" lightActive={lightActive}>
                            <select
                                id="field-status"
                                className={selectCls}
                                value={form.status}
                                onChange={(e) => set('status', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {statusOptions.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </FormField>
                        <div />

                        <div className="col-span-2">
                            <FormField label="Observação" lightActive={lightActive}>
                                <textarea
                                    id="field-observacao"
                                    rows={3}
                                    className={`${inputCls} h-auto py-2 resize-y`}
                                    value={form.observacao}
                                    onChange={(e) => set('observacao', e.target.value)}
                                    placeholder="Notas sobre o andamento, dependências, próximos passos..."
                                />
                            </FormField>
                        </div>
                    </div>
                </form>

                <div className={`flex-none border-t px-6 py-4 flex items-center justify-between gap-3 ${lightActive ? 'border-zinc-200' : 'border-zinc-800'}`}>
                    {error && (
                        <div className={`flex items-center gap-2 text-sm ${lightActive ? 'text-rose-600' : 'text-rose-400'}`}>
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {!error && <div />}
                    <div className="flex gap-3">
                        <button
                            id="proposal-modal-cancel"
                            type="button"
                            onClick={onClose}
                            disabled={isPending}
                            className={`h-9 px-4 rounded-lg border text-sm transition-colors disabled:opacity-50 ${lightActive ? 'border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            id="proposal-modal-submit"
                            type="submit"
                            form="proposal-form"
                            disabled={isPending}
                            className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === 'add' ? 'Adicionar Proposta' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
