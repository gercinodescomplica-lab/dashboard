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
}

function FormField({
    label,
    children,
    required,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

const inputCls =
    'h-9 w-full px-3 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all';
const selectCls =
    'h-9 w-full px-3 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none';

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
}: ProposalModalProps) {
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

            <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-none">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-100">
                            {mode === 'add' ? 'Nova Proposta' : 'Editar Proposta'}
                        </h2>
                        {mode === 'edit' && proposta && (
                            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{proposta.numeroProposta}</p>
                        )}
                    </div>
                    <button
                        id="proposal-modal-close"
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form id="proposal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 grid grid-cols-2 gap-4">
                        <FormField label="Número da Proposta" required>
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
                        <FormField label="Fase">
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
                            <FormField label="Nome da Oportunidade" required>
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
                            <FormField label="Cliente" required>
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

                        <FormField label="Gerência (GRC)">
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
                        <FormField label="Gerente (Manager)">
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
                            <FormField label="Proprietário da Oportunidade">
                                <input
                                    id="field-proprietario"
                                    className={inputCls}
                                    value={form.proprietario}
                                    onChange={(e) => set('proprietario', e.target.value)}
                                    placeholder="Nome do proprietário"
                                />
                            </FormField>
                        </div>

                        <FormField label="Valor (R$)">
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
                        <FormField label="Receita Esperada (R$)">
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

                        <FormField label="Probabilidade (%)">
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
                        <FormField label="Duração (dias)">
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

                        <FormField label="Data de Criação">
                            <input
                                id="field-dataCriacao"
                                type="date"
                                className={inputCls}
                                value={form.dataCriacao}
                                onChange={(e) => set('dataCriacao', e.target.value)}
                            />
                        </FormField>
                        <FormField label="Data de Fechamento">
                            <input
                                id="field-dataFechamento"
                                type="date"
                                className={inputCls}
                                value={form.dataFechamento}
                                onChange={(e) => set('dataFechamento', e.target.value)}
                            />
                        </FormField>

                        <div className="col-span-2 border-t border-zinc-800 pt-4 mt-2">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Status do Pipeline</p>
                        </div>

                        <FormField label="Status">
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
                            <FormField label="Observação">
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

                <div className="flex-none border-t border-zinc-800 px-6 py-4 flex items-center justify-between gap-3">
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-sm">
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
                            className="h-9 px-4 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-50"
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
