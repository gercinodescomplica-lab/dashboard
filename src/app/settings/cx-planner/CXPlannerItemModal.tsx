'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { CXBoardItem } from '@/db/queries';
import { CXStatus } from '@/types/manager';
import { CXPlannerFormValues } from './actions';
import { PRIORIDADE_OPTIONS, PRIORIDADE_CONFIG, PRIORIDADE_FALLBACK, STATUS_COLUMNS, PrioridadeTexto } from './board-config';

interface ManagerOption {
    id: string;
    name: string;
}

interface CXPlannerItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: CXBoardItem | null;
    managerOptions: ManagerOption[];
    defaultManagerId?: string;
    defaultStatus?: CXStatus;
    onSave: (values: CXPlannerFormValues) => Promise<void>;
    onDelete?: () => Promise<void>;
}

function emptyValues(defaultManagerId = '', defaultStatus: CXStatus = 'pendente'): CXPlannerFormValues {
    return {
        managerId: defaultManagerId,
        cliente: '',
        titulo: '',
        problema: '',
        solucaoProposta: '',
        status: defaultStatus,
        dataInicio: '',
        dataFim: '',
        percentComplete: 0,
        prioridadeTexto: PRIORIDADE_FALLBACK,
        isVisible: true,
    };
}

// Itens que já existiam antes desta migração têm prioridade_texto = NULL,
// mas podem ter uma criticidade definida manualmente no fluxo antigo do
// Settings. Ao abrir esses itens no board, derivamos uma prioridade inicial
// A PARTIR da criticidade em vez de usar um fallback fixo — senão salvar
// sem tocar em prioridade reescreveria a criticidade existente com o valor
// neutro (ver finding #4 do review). Só itens novos (create, sem `item`)
// usam o fallback neutro puro, sem criticidade pra derivar.
function priorityFromCriticidade(criticidade: string | null | undefined): PrioridadeTexto {
    if (criticidade === 'alta') return 'Urgente';
    if (criticidade === 'media') return 'Importante';
    return PRIORIDADE_FALLBACK;
}

function statusForPercent(percent: number): CXStatus {
    if (percent >= 100) return 'resolvido';
    if (percent > 0) return 'analise';
    return 'pendente';
}

export function CXPlannerItemModal({
    open,
    onOpenChange,
    item,
    managerOptions,
    defaultManagerId,
    defaultStatus,
    onSave,
    onDelete,
}: CXPlannerItemModalProps) {
    const [values, setValues] = useState<CXPlannerFormValues>(emptyValues(defaultManagerId, defaultStatus));
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setErrorMessage(null);
        if (item) {
            setValues({
                managerId: item.managerId,
                cliente: item.cliente,
                titulo: item.titulo,
                problema: item.problema,
                solucaoProposta: item.solucaoProposta,
                status: item.status,
                dataInicio: (item.dataInicio ?? '').slice(0, 10),
                dataFim: (item.dataFim ?? '').slice(0, 10),
                percentComplete: item.percentComplete ?? 0,
                prioridadeTexto: item.prioridadeTexto ?? priorityFromCriticidade(item.criticidade),
                isVisible: item.isVisible ?? true,
            });
        } else {
            setValues(emptyValues(defaultManagerId, defaultStatus));
        }
    }, [open, item, defaultManagerId, defaultStatus]);

    const update = <K extends keyof CXPlannerFormValues>(field: K, value: CXPlannerFormValues[K]) => {
        setValues((prev) => ({ ...prev, [field]: value }));
    };

    const handlePercentChange = (percent: number) => {
        setValues((prev) => ({ ...prev, percentComplete: percent, status: statusForPercent(percent) }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setErrorMessage(null);
        try {
            await onSave(values);
            onOpenChange(false);
        } catch (err) {
            // onSave (CXPlannerBoard.handleSave) throws when the underlying
            // create/update server action returns null (e.g. target manager
            // was deleted meanwhile) — surface that instead of silently
            // closing as if the save succeeded.
            setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        if (!window.confirm('Excluir este item de CX? Essa ação não pode ser desfeita.')) return;
        setIsDeleting(true);
        setErrorMessage(null);
        try {
            await onDelete();
            onOpenChange(false);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Erro ao excluir. Tente novamente.');
        } finally {
            setIsDeleting(false);
        }
    };

    const canSave = values.managerId.trim().length > 0 && values.cliente.trim().length > 0 && values.problema.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>{item ? 'Editar item de CX' : 'Nova tarefa de CX'}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Gerente</Label>
                            <Select value={values.managerId} onValueChange={(v) => update('managerId', v)}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                    <SelectValue placeholder="Selecione o gerente" />
                                </SelectTrigger>
                                <SelectContent>
                                    {managerOptions.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Cliente / Órgão</Label>
                            <Input
                                value={values.cliente}
                                onChange={(e) => update('cliente', e.target.value)}
                                placeholder="Ex: SEFAZ"
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Título</Label>
                        <Input
                            value={values.titulo}
                            onChange={(e) => update('titulo', e.target.value)}
                            placeholder="Resumo do problema"
                            className="bg-zinc-900 border-zinc-800 text-zinc-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Descrição do problema</Label>
                        {/* problema guarda um histórico com múltiplas entradas
                            datadas separadas por quebra de linha (CXTab.tsx
                            parseia isso pra exibir entradas distintas). Um
                            <Input> de linha única deixaria o HTML descartar
                            CR/LF ao editar, achatando o histórico inteiro numa
                            linha só — por isso <textarea>. */}
                        <textarea
                            value={values.problema}
                            onChange={(e) => update('problema', e.target.value)}
                            placeholder="Descreva o problema relatado em detalhes"
                            rows={4}
                            className="w-full rounded-md border bg-zinc-900 border-zinc-800 text-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Solução proposta</Label>
                        <Input
                            value={values.solucaoProposta}
                            onChange={(e) => update('solucaoProposta', e.target.value)}
                            placeholder="Descreva a solução ou encaminhamento"
                            className="bg-zinc-900 border-zinc-800 text-zinc-200"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Data início</Label>
                            <Input
                                type="date"
                                value={values.dataInicio}
                                onChange={(e) => update('dataInicio', e.target.value)}
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Prazo (data fim)</Label>
                            <Input
                                type="date"
                                value={values.dataFim}
                                onChange={(e) => update('dataFim', e.target.value)}
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Prioridade</Label>
                        <div className="flex gap-2 flex-wrap">
                            {PRIORIDADE_OPTIONS.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => update('prioridadeTexto', p)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${values.prioridadeTexto === p
                                        ? PRIORIDADE_CONFIG[p].badge + ' ring-2 ring-offset-1 ring-offset-zinc-950 ring-current'
                                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">% de conclusão — {values.percentComplete}%</Label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={values.percentComplete}
                            onChange={(e) => handlePercentChange(Number(e.target.value))}
                            className="w-full accent-indigo-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Status</Label>
                        <div className="flex gap-2 flex-wrap">
                            {STATUS_COLUMNS.map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => update('status', s.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${values.status === s.key
                                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 ring-2 ring-offset-1 ring-offset-zinc-950 ring-current'
                                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                                        }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-zinc-600">Sugerido automaticamente pelo % de conclusão, mas pode ser mudado aqui.</p>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={values.isVisible}
                            onChange={(e) => update('isVisible', e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-950 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-300 transition-colors">Mostrar no painel do gerente</span>
                    </label>
                </div>

                {errorMessage && (
                    <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                        {errorMessage}
                    </p>
                )}

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    {item && onDelete ? (
                        <Button
                            variant="ghost"
                            onClick={handleDelete}
                            disabled={isDeleting || isSaving}
                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                            <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
                        </Button>
                    ) : <span />}
                    <Button
                        onClick={handleSave}
                        disabled={!canSave || isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
