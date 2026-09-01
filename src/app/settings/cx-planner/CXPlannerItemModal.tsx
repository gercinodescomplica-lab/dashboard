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
import { PRIORIDADE_OPTIONS, PRIORIDADE_CONFIG, PRIORIDADE_FALLBACK, STATUS_LABELS, PrioridadeTexto } from './board-config';
import { parseCXLogEntries } from '@/lib/cx-log';

interface ManagerOption {
    id: string;
    name: string;
}

interface CXPlannerItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: CXBoardItem | null;
    managerOptions: ManagerOption[];
    bucketOptions: { id: number; name: string }[];
    userOptions: { id: number; name: string }[];
    subtituloSuggestions: string[];
    defaultManagerId?: string;
    defaultBucketId?: number | null;
    onSave: (values: CXPlannerFormValues) => Promise<void>;
    onDelete?: () => Promise<void>;
    lightActive?: boolean;
}

function emptyValues(defaultManagerId = '', defaultBucketId: number | null = null): CXPlannerFormValues {
    return {
        managerId: defaultManagerId,
        cliente: '',
        titulo: '',
        problema: '',
        solucaoProposta: '',
        subtitulo: '',
        dataInicio: '',
        dataFim: '',
        percentComplete: 0,
        prioridadeTexto: PRIORIDADE_FALLBACK,
        responsavelId: null,
        bucketId: defaultBucketId,
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

// Só para exibição no badge read-only — o status real é derivado no server
// (statusFromPercent em actions.ts). Não altera o form.
function derivedStatus(percent: number): CXStatus {
    if (percent >= 100) return 'resolvido';
    if (percent > 0) return 'analise';
    return 'pendente';
}

export function CXPlannerItemModal({
    open,
    onOpenChange,
    item,
    managerOptions,
    bucketOptions,
    userOptions,
    subtituloSuggestions,
    defaultManagerId,
    defaultBucketId,
    onSave,
    onDelete,
    lightActive = false,
}: CXPlannerItemModalProps) {
    const [values, setValues] = useState<CXPlannerFormValues>(emptyValues(defaultManagerId, defaultBucketId ?? null));
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // Excluir é permanente e reflete nos dois lugares (some do board e da
    // aba CX do gerente, sem trash/undo) — por isso é um clique pra pedir
    // confirmação e outro pra confirmar de verdade, em vez de um
    // window.confirm() nativo (que além de menos visível trava a automação
    // de navegador em alguns ambientes).
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    useEffect(() => {
        if (!open) return;
        setErrorMessage(null);
        setConfirmingDelete(false);
        if (item) {
            setValues({
                managerId: item.managerId,
                cliente: item.cliente,
                titulo: item.titulo,
                problema: item.problema,
                solucaoProposta: item.solucaoProposta,
                subtitulo: item.subtitulo ?? '',
                dataInicio: (item.dataInicio ?? '').slice(0, 10),
                dataFim: (item.dataFim ?? '').slice(0, 10),
                percentComplete: item.percentComplete ?? 0,
                prioridadeTexto: item.prioridadeTexto ?? priorityFromCriticidade(item.criticidade),
                responsavelId: item.responsavelId ?? null,
                bucketId: item.bucketId ?? null,
                isVisible: item.isVisible ?? true,
            });
        } else {
            setValues(emptyValues(defaultManagerId, defaultBucketId ?? null));
        }
    }, [open, item, defaultManagerId, defaultBucketId]);

    const update = <K extends keyof CXPlannerFormValues>(field: K, value: CXPlannerFormValues[K]) => {
        setValues((prev) => ({ ...prev, [field]: value }));
    };

    const handlePercentChange = (percent: number) => {
        setValues((prev) => ({ ...prev, percentComplete: percent }));
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

    const handleDeleteClick = () => {
        if (!onDelete) return;
        // Primeiro clique só arma a confirmação; a exclusão de verdade só
        // acontece no segundo clique (ver performDelete).
        if (!confirmingDelete) {
            setConfirmingDelete(true);
            return;
        }
        void performDelete();
    };

    const performDelete = async () => {
        if (!onDelete) return;
        setIsDeleting(true);
        setErrorMessage(null);
        try {
            await onDelete();
            onOpenChange(false);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Erro ao excluir. Tente novamente.');
            setConfirmingDelete(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const canSave = values.managerId.trim().length > 0 && values.cliente.trim().length > 0 && values.problema.trim().length > 0;

    // Histórico fiel ao que o Planner registrou pra este item — parseado a
    // partir do `problema` como ele veio carregado (não do texto sendo
    // digitado agora), pra servir de referência estável enquanto o campo de
    // baixo é editado. Só exibido quando há mais de uma entrada — um
    // problema recém-criado com um parágrafo só não precisa dessa seção.
    const logEntries = item ? parseCXLogEntries(item.problema) : [];

    // Mesma convenção de theming do resto do app (ver CXTab.tsx): um mapa de
    // classes light/dark montado uma vez, em vez de ternário repetido em
    // cada campo do formulário.
    const T = {
        dialog: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100',
        label: lightActive ? 'text-zinc-600' : 'text-zinc-400',
        field: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-zinc-800 text-zinc-200',
        historyBox: lightActive ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-950',
        historyEntryBorder: lightActive ? 'border-zinc-300' : 'border-zinc-800',
        historyDate: lightActive ? 'text-indigo-600' : 'text-indigo-400/80',
        historyText: lightActive ? 'text-zinc-600' : 'text-zinc-400',
        chipInactive: lightActive
            ? 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
            : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600',
        statusActive: lightActive
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
        ringOffset: lightActive ? 'ring-offset-white' : 'ring-offset-zinc-950',
        helperText: lightActive ? 'text-zinc-500' : 'text-zinc-600',
        checkbox: lightActive ? 'border-zinc-300 bg-white' : 'border-zinc-700 bg-zinc-900',
        checkboxLabel: lightActive ? 'text-zinc-600 group-hover:text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-300',
        messageBox: lightActive ? 'bg-red-50 border-red-300 text-red-700' : 'bg-red-500/10 border-red-500/30 text-red-400',
        cancelBtn: lightActive ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-400 hover:text-white',
        deleteGhost: lightActive ? 'text-red-600 hover:text-red-500 hover:bg-red-50' : 'text-red-500 hover:text-red-400 hover:bg-red-500/10',
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`max-w-2xl max-h-[85vh] overflow-y-auto transition-colors duration-200 ${T.dialog}`}>
                <DialogHeader>
                    <DialogTitle>{item ? 'Editar item de CX' : 'Nova tarefa de CX'}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className={T.label}>Gerente</Label>
                            <Select value={values.managerId} onValueChange={(v) => update('managerId', v)}>
                                <SelectTrigger className={T.field}>
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
                            <Label className={T.label}>Cliente / Órgão</Label>
                            <Input
                                value={values.cliente}
                                onChange={(e) => update('cliente', e.target.value)}
                                placeholder="Ex: SEFAZ"
                                className={T.field}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className={T.label}>Título</Label>
                        <Input
                            value={values.titulo}
                            onChange={(e) => update('titulo', e.target.value)}
                            placeholder="Resumo do problema"
                            className={T.field}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className={T.label}>Subtítulo / área</Label>
                        <Input
                            value={values.subtitulo}
                            onChange={(e) => update('subtitulo', e.target.value)}
                            placeholder="Ex: Infraestrutura"
                            list="cx-subtitulo-suggestions"
                            className={T.field}
                        />
                        <datalist id="cx-subtitulo-suggestions">
                            {subtituloSuggestions.map((s) => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                    </div>

                    <div className="space-y-1.5">
                        <Label className={T.label}>Descrição do problema</Label>
                        {logEntries.length > 1 && (
                            <div className={`max-h-32 overflow-y-auto rounded-md border px-3 py-2 flex flex-col gap-2 mb-1.5 ${T.historyBox}`}>
                                {logEntries.map((entry, idx) => (
                                    <div key={idx} className={`flex flex-col gap-0.5 border-l-2 pl-2 ${T.historyEntryBorder}`}>
                                        {entry.date && (
                                            <span className={`text-[10px] font-mono font-semibold ${T.historyDate}`}>{entry.date}</span>
                                        )}
                                        <span className={`text-xs break-words ${T.historyText}`}>{entry.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}
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
                            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${lightActive ? 'placeholder:text-zinc-400' : 'placeholder:text-zinc-600'} ${T.field}`}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className={T.label}>Solução proposta</Label>
                        <Input
                            value={values.solucaoProposta}
                            onChange={(e) => update('solucaoProposta', e.target.value)}
                            placeholder="Descreva a solução ou encaminhamento"
                            className={T.field}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className={T.label}>Data início</Label>
                            <Input
                                type="date"
                                value={values.dataInicio}
                                onChange={(e) => update('dataInicio', e.target.value)}
                                className={T.field}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={T.label}>Prazo (data fim)</Label>
                            <Input
                                type="date"
                                value={values.dataFim}
                                onChange={(e) => update('dataFim', e.target.value)}
                                className={T.field}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className={T.label}>Prioridade</Label>
                        <div className="flex gap-2 flex-wrap">
                            {PRIORIDADE_OPTIONS.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => update('prioridadeTexto', p)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${values.prioridadeTexto === p
                                        ? (lightActive ? PRIORIDADE_CONFIG[p].badgeLight : PRIORIDADE_CONFIG[p].badge) + ` ring-2 ring-offset-1 ${T.ringOffset} ring-current`
                                        : T.chipInactive
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className={T.label}>Responsável</Label>
                            <Select
                                value={values.responsavelId == null ? 'none' : String(values.responsavelId)}
                                onValueChange={(v) => update('responsavelId', v === 'none' ? null : Number(v))}
                            >
                                <SelectTrigger className={T.field}>
                                    <SelectValue placeholder="— nenhum —" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— nenhum —</SelectItem>
                                    {userOptions.map((u) => (
                                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className={T.label}>Bucket</Label>
                            <Select
                                value={values.bucketId == null ? 'none' : String(values.bucketId)}
                                onValueChange={(v) => update('bucketId', v === 'none' ? null : Number(v))}
                            >
                                <SelectTrigger className={T.field}>
                                    <SelectValue placeholder="Entrada (sem bucket)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Entrada (sem bucket)</SelectItem>
                                    {bucketOptions.map((b) => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className={T.label}>% de conclusão — {values.percentComplete}%</Label>
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
                        <Label className={T.label}>Status</Label>
                        <div className="flex items-center gap-2">
                            <span
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${T.statusActive}`}
                                title="Derivado automaticamente do % de conclusão"
                            >
                                {STATUS_LABELS[derivedStatus(values.percentComplete)]}
                            </span>
                            <span className={`text-[11px] ${T.helperText}`}>derivado do % de conclusão</span>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={values.isVisible}
                            onChange={(e) => update('isVisible', e.target.checked)}
                            className={`w-4 h-4 rounded focus:ring-blue-500 accent-blue-500 cursor-pointer ${T.ringOffset} ${T.checkbox}`}
                        />
                        <span className={`text-xs font-semibold transition-colors ${T.checkboxLabel}`}>Mostrar no painel do gerente</span>
                    </label>
                </div>

                {errorMessage && (
                    <p className={`text-xs font-semibold rounded-md px-3 py-2 border ${T.messageBox}`}>
                        {errorMessage}
                    </p>
                )}

                {confirmingDelete && (
                    <p className={`text-xs font-semibold rounded-md px-3 py-2 border ${T.messageBox}`}>
                        Isso apaga o item de vez — some daqui do board <strong>e</strong> da aba de CX do gerente, sem
                        como desfazer. Se é só pra tirar da visão do gerente, desmarque &quot;Mostrar no painel do
                        gerente&quot; em vez de excluir.
                    </p>
                )}

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    {item && onDelete ? (
                        <div className="flex items-center gap-2">
                            <Button
                                variant={confirmingDelete ? 'destructive' : 'ghost'}
                                onClick={handleDeleteClick}
                                disabled={isDeleting || isSaving}
                                className={confirmingDelete ? 'font-semibold' : T.deleteGhost}
                            >
                                <Trash2 className="w-4 h-4 mr-1.5" />
                                {isDeleting ? 'Excluindo...' : confirmingDelete ? 'Confirmar exclusão' : 'Excluir'}
                            </Button>
                            {confirmingDelete && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setConfirmingDelete(false)}
                                    disabled={isDeleting}
                                    className={T.cancelBtn}
                                >
                                    Cancelar
                                </Button>
                            )}
                        </div>
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
