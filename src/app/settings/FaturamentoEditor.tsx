'use client';

import { useState, useEffect } from 'react';
import { Loader2, DollarSign, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { getFaturamento2025Action, saveFaturamento2025Action } from './actions';
import { formatCurrency } from '@/lib/format';

export function FaturamentoEditor() {
    const [valueStr, setValueStr] = useState<string>('');
    const [numericValue, setNumericValue] = useState<number>(630386397.11);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const val = await getFaturamento2025Action();
                setNumericValue(val);
                setValueStr(val.toString());
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setValueStr(raw);
        // Replace commas with dots if user types in pt-BR format (e.g. 630386397,11)
        const cleaned = raw.replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) {
            setNumericValue(parsed);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatus('idle');
        setErrorMsg('');
        try {
            const cleaned = valueStr.replace(/\./g, '').replace(',', '.');
            const valToSave = parseFloat(cleaned);
            if (isNaN(valToSave)) {
                throw new Error('Por favor, informe um valor numérico válido.');
            }
            await saveFaturamento2025Action(valToSave);
            setNumericValue(valToSave);
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err?.message || 'Erro ao salvar o faturamento.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando faturamento...
            </div>
        );
    }

    return (
        <div className="max-w-3xl space-y-6 p-2">
            <div>
                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                    Faturamento de 2025
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                    Configure o valor consolidado do Faturamento de 2025 para exibição no primeiro card da tela inicial do Dashboard.
                </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
                <div className="space-y-2">
                    <label htmlFor="faturamento2025" className="block text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                        Valor do Faturamento (R$)
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold text-lg">
                            R$
                        </span>
                        <input
                            id="faturamento2025"
                            type="text"
                            value={valueStr}
                            onChange={handleChange}
                            placeholder="630386397.11"
                            className="w-full pl-12 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-mono text-lg font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                    <p className="text-xs text-zinc-500">
                        Insira apenas números e ponto/vírgula decimal (Ex: 630386397.11 ou 630.386.397,11)
                    </p>
                </div>

                {/* Preview Box */}
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <span className="text-xs uppercase font-semibold tracking-wider text-zinc-500">Pré-visualização do Card</span>
                        <p className="text-xs text-zinc-400 mt-0.5">Como será exibido no Dashboard DRM</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold font-mono text-emerald-400">
                            {formatCurrency(numericValue)}
                        </p>
                    </div>
                </div>

                {/* Status Messages */}
                {status === 'success' && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Faturamento de 2025 atualizado com sucesso!
                    </div>
                )}
                {status === 'error' && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {errorMsg || 'Erro ao salvar o faturamento.'}
                    </div>
                )}

                {/* Action Button */}
                <div className="pt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
