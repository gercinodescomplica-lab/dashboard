'use client';

import { useState, useTransition, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { ContratoRow } from '@/db/queries';
import { createContratoAction, updateContratoAction } from '../actions';

interface ContractModalProps {
    open: boolean;
    mode: 'add' | 'edit';
    contrato: ContratoRow | null;
    managersList: { id: string; name: string; role: string }[];
    gerencias: string[];
    onClose: () => void;
    onSuccess: () => void;
    lightActive?: boolean;
}

const TIPOS = ['SUSTENTAÇÃO', 'PROJETOS'];
const SITUACOES = ['Vigente', 'Encerrado', 'Suspenso', 'Em negociação'];

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
        ? 'h-9 w-full px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all'
        : 'h-9 w-full px-3 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all';
}
function getSelectCls(lightActive: boolean) {
    return lightActive
        ? 'h-9 w-full px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none'
        : 'h-9 w-full px-3 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none';
}

export function ContractModal({
    open,
    mode,
    contrato,
    managersList,
    gerencias,
    onClose,
    onSuccess,
    lightActive = false,
}: ContractModalProps) {
    const inputCls = getInputCls(lightActive);
    const selectCls = getSelectCls(lightActive);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        id: '',
        numeroContrato: '',
        protheus: '',
        cliente: '',
        desde: '',
        dtInicioVigencia: '',
        dtFimVigencia: '',
        vlContratado: '',
        vlFaturado: '',
        vlSaldo: '',
        tipo: '',
        situacao: '',
        vigente: true,
        diretoria: 'DRM',
        gerencia: '',
        nomeGerente: '',
        objeto: '',
        managerId: '',
    });

    // Sync form with contrato prop when editing
    useEffect(() => {
        if (mode === 'edit' && contrato) {
            setForm({
                id: contrato.id,
                numeroContrato: contrato.numeroContrato,
                protheus: contrato.protheus ?? '',
                cliente: contrato.cliente,
                desde: contrato.desde ?? '',
                dtInicioVigencia: contrato.dtInicioVigencia ?? '',
                dtFimVigencia: contrato.dtFimVigencia ?? '',
                vlContratado: contrato.vlContratado?.toString() ?? '',
                vlFaturado: contrato.vlFaturado?.toString() ?? '',
                vlSaldo: contrato.vlSaldo?.toString() ?? '',
                tipo: contrato.tipo ?? '',
                situacao: contrato.situacao ?? '',
                vigente: contrato.vigente ?? true,
                diretoria: contrato.diretoria ?? 'DRM',
                gerencia: contrato.gerencia ?? '',
                nomeGerente: contrato.nomeGerente ?? '',
                objeto: contrato.objeto ?? '',
                managerId: contrato.managerId ?? '',
            });
        } else if (mode === 'add') {
            setForm({
                id: '',
                numeroContrato: '',
                protheus: '',
                cliente: '',
                desde: '',
                dtInicioVigencia: '',
                dtFimVigencia: '',
                vlContratado: '',
                vlFaturado: '',
                vlSaldo: '',
                tipo: '',
                situacao: 'Vigente',
                vigente: true,
                diretoria: 'DRM',
                gerencia: '',
                nomeGerente: '',
                objeto: '',
                managerId: '',
            });
        }
        setError(null);
    }, [mode, contrato, open]);

    if (!open) return null;

    function set(field: string, value: string | boolean) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const payload = {
            id: form.id || crypto.randomUUID(),
            numeroContrato: form.numeroContrato.trim(),
            protheus: form.protheus.trim() || null,
            cliente: form.cliente.trim(),
            desde: form.desde || null,
            dtInicioVigencia: form.dtInicioVigencia || null,
            dtFimVigencia: form.dtFimVigencia || null,
            vlContratado: form.vlContratado ? parseFloat(form.vlContratado) : null,
            vlFaturado: form.vlFaturado ? parseFloat(form.vlFaturado) : null,
            vlSaldo: form.vlSaldo ? parseFloat(form.vlSaldo) : null,
            tipo: form.tipo || null,
            situacao: form.situacao || null,
            vigente: form.vigente,
            diretoria: form.diretoria || 'DRM',
            gerencia: form.gerencia || null,
            nomeGerente: form.nomeGerente.trim() || null,
            objeto: form.objeto.trim() || null,
            managerId: form.managerId || null,
        };

        startTransition(async () => {
            const result =
                mode === 'add'
                    ? await createContratoAction(payload)
                    : await updateContratoAction(payload.id, payload);

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
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col border rounded-2xl shadow-2xl overflow-hidden mx-4 ${lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-800'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b flex-none ${lightActive ? 'border-zinc-200' : 'border-zinc-800'}`}>
                    <div>
                        <h2 className={`text-lg font-bold ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>
                            {mode === 'add' ? 'Novo Contrato' : 'Editar Contrato'}
                        </h2>
                        {mode === 'edit' && contrato && (
                            <p className={`text-xs mt-0.5 font-mono ${lightActive ? 'text-zinc-500' : 'text-zinc-500'}`}>{contrato.numeroContrato}</p>
                        )}
                    </div>
                    <button
                        id="contract-modal-close"
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form id="contract-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 grid grid-cols-2 gap-4">
                        {/* Row 1 */}
                        <FormField label="Número do Contrato" required lightActive={lightActive}>
                            <input
                                id="field-numeroContrato"
                                className={inputCls}
                                value={form.numeroContrato}
                                onChange={(e) => set('numeroContrato', e.target.value)}
                                placeholder="TC 001/2025"
                                required
                                disabled={mode === 'edit'}
                            />
                        </FormField>
                        <FormField label="Código Protheus" lightActive={lightActive}>
                            <input
                                id="field-protheus"
                                className={inputCls}
                                value={form.protheus}
                                onChange={(e) => set('protheus', e.target.value)}
                                placeholder="Ex: 000001"
                            />
                        </FormField>

                        {/* Row 2 */}
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
                        <FormField label="Diretoria" lightActive={lightActive}>
                            <input
                                id="field-diretoria"
                                className={inputCls}
                                value={form.diretoria}
                                onChange={(e) => set('diretoria', e.target.value)}
                                placeholder="DRM"
                            />
                        </FormField>

                        {/* Row 3 - Gerência & Manager */}
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

                        {/* Row 4 - Nome Gerente */}
                        <FormField label="Nome Completo do Gerente" lightActive={lightActive}>
                            <input
                                id="field-nomeGerente"
                                className={inputCls}
                                value={form.nomeGerente}
                                onChange={(e) => set('nomeGerente', e.target.value)}
                                placeholder="Nome completo (denormalizado do CSV)"
                            />
                        </FormField>
                        <FormField label="Tipo" lightActive={lightActive}>
                            <select
                                id="field-tipo"
                                className={selectCls}
                                value={form.tipo}
                                onChange={(e) => set('tipo', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {TIPOS.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </FormField>

                        {/* Row 5 - Dates */}
                        <FormField label="Início (Desde)" lightActive={lightActive}>
                            <input
                                id="field-desde"
                                type="date"
                                className={inputCls}
                                value={form.desde}
                                onChange={(e) => set('desde', e.target.value)}
                            />
                        </FormField>
                        <FormField label="Início Vigência" lightActive={lightActive}>
                            <input
                                id="field-dtInicioVigencia"
                                type="date"
                                className={inputCls}
                                value={form.dtInicioVigencia}
                                onChange={(e) => set('dtInicioVigencia', e.target.value)}
                            />
                        </FormField>

                        {/* Row 6 - Dates cont. */}
                        <FormField label="Fim Vigência" lightActive={lightActive}>
                            <input
                                id="field-dtFimVigencia"
                                type="date"
                                className={inputCls}
                                value={form.dtFimVigencia}
                                onChange={(e) => set('dtFimVigencia', e.target.value)}
                            />
                        </FormField>
                        <FormField label="Situação" lightActive={lightActive}>
                            <select
                                id="field-situacao"
                                className={selectCls}
                                value={form.situacao}
                                onChange={(e) => set('situacao', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {SITUACOES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </FormField>

                        {/* Row 7 - Values */}
                        <FormField label="Valor Contratado (R$)" lightActive={lightActive}>
                            <input
                                id="field-vlContratado"
                                type="number"
                                step="0.01"
                                className={inputCls}
                                value={form.vlContratado}
                                onChange={(e) => set('vlContratado', e.target.value)}
                                placeholder="0.00"
                            />
                        </FormField>
                        <FormField label="Valor Faturado (R$)" lightActive={lightActive}>
                            <input
                                id="field-vlFaturado"
                                type="number"
                                step="0.01"
                                className={inputCls}
                                value={form.vlFaturado}
                                onChange={(e) => set('vlFaturado', e.target.value)}
                                placeholder="0.00"
                            />
                        </FormField>

                        {/* Row 8 - Saldo + Vigente */}
                        <FormField label="Saldo (R$)" lightActive={lightActive}>
                            <input
                                id="field-vlSaldo"
                                type="number"
                                step="0.01"
                                className={inputCls}
                                value={form.vlSaldo}
                                onChange={(e) => set('vlSaldo', e.target.value)}
                                placeholder="0.00"
                            />
                        </FormField>
                        <FormField label="Vigente" lightActive={lightActive}>
                            <div className="flex items-center h-9 gap-3">
                                <button
                                    id="field-vigente-toggle"
                                    type="button"
                                    onClick={() => set('vigente', !form.vigente)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${lightActive ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'}
                                        ${form.vigente ? 'bg-indigo-600' : (lightActive ? 'bg-zinc-300' : 'bg-zinc-700')}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform
                                            ${form.vigente ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                                <span className={`text-sm ${lightActive ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                    {form.vigente ? 'Contrato vigente' : 'Não vigente'}
                                </span>
                            </div>
                        </FormField>

                        {/* Row 9 - Objeto (full width) */}
                        <div className="col-span-2">
                            <FormField label="Objeto / Descrição" lightActive={lightActive}>
                                <textarea
                                    id="field-objeto"
                                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none ${lightActive ? 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400' : 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600'}`}
                                    rows={3}
                                    value={form.objeto}
                                    onChange={(e) => set('objeto', e.target.value)}
                                    placeholder="Descrição do objeto do contrato..."
                                />
                            </FormField>
                        </div>
                    </div>
                </form>

                {/* Footer */}
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
                            id="contract-modal-cancel"
                            type="button"
                            onClick={onClose}
                            disabled={isPending}
                            className={`h-9 px-4 rounded-lg border text-sm transition-colors disabled:opacity-50 ${lightActive ? 'border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            id="contract-modal-submit"
                            type="submit"
                            form="contract-form"
                            disabled={isPending}
                            className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === 'add' ? 'Adicionar Contrato' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
