import { useState } from 'react';
import { Project, QuarterData, PipelineData, Manager, ProjectHistoryItem } from '@/types/manager';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy, Sparkles, Info, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';
import { calculateProject2026Value } from '@/lib/calc';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProjectHistoryModal } from './ProjectHistoryModal';

interface Props {
    pipeline: PipelineData;
    onChange: (pipeline: PipelineData) => void;
}

type QuarterKey = 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado';

interface FlatProject {
    qKey: QuarterKey;
    originalIndex: number;
    project: Project;
}

export function PipelineEditor({ pipeline, onChange }: Props) {
    const [historyModalTarget, setHistoryModalTarget] = useState<{
        qKey: QuarterKey;
        index: number;
        project: Project;
    } | null>(null);
    const handleAdd = () => {
        const newProj: Project = { name: 'Novo Projeto', orgao: '', value: 0, temperature: 'morno' };
        const newQ1 = [...(pipeline.q1?.projects || []), newProj];
        onChange({
            ...pipeline,
            q1: {
                total: newQ1.reduce((acc, p) => acc + p.value, 0),
                projects: newQ1
            }
        });
    };

    const handleUpdate = (qKey: QuarterKey, index: number, field: keyof Project, val: any) => {
        const cloneP = { ...pipeline };
        const qData = { ...cloneP[qKey] };
        const projects = [...(qData.projects || [])];
        projects[index] = { ...projects[index], [field]: val };
        qData.projects = projects;
        qData.total = projects.reduce((acc, p) => acc + p.value, 0);
        cloneP[qKey] = qData;
        onChange(cloneP);
    };

    const handleMove = (fromQ: QuarterKey, toQ: QuarterKey, index: number) => {
        if (fromQ === toQ) return;
        const cloneP = { ...pipeline };
        const sourceQ = { ...cloneP[fromQ], projects: [...(cloneP[fromQ]?.projects || [])] };
        const destQ = { ...cloneP[toQ], projects: [...(cloneP[toQ]?.projects || [])] };

        const [movedProject] = sourceQ.projects.splice(index, 1);
        destQ.projects.push(movedProject);

        sourceQ.total = sourceQ.projects.reduce((acc, p) => acc + p.value, 0);
        destQ.total = destQ.projects.reduce((acc, p) => acc + p.value, 0);

        cloneP[fromQ] = sourceQ;
        cloneP[toQ] = destQ;
        onChange(cloneP);
    };

    const handleDuplicate = (qKey: QuarterKey, index: number) => {
        const cloneP = { ...pipeline };
        const qData = { ...cloneP[qKey] };
        const projects = [...(qData.projects || [])];
        const copy = { ...projects[index], name: `${projects[index].name} (cópia)` };
        projects.splice(index + 1, 0, copy);
        qData.projects = projects;
        qData.total = projects.reduce((acc, p) => acc + p.value, 0);
        cloneP[qKey] = qData;
        onChange(cloneP);
    };

    const handleDelete = (qKey: QuarterKey, index: number) => {
        const cloneP = { ...pipeline };
        const qData = { ...cloneP[qKey] };
        const projects = [...(qData.projects || [])];
        projects.splice(index, 1);
        qData.projects = projects;
        qData.total = projects.reduce((acc, p) => acc + p.value, 0);
        cloneP[qKey] = qData;
        onChange(cloneP);
    };

    // Flatten all projects for table view
    const allProjects: FlatProject[] = [];
    (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as QuarterKey[]).forEach(qKey => {
        pipeline[qKey]?.projects.forEach((proj, i) => {
            allProjects.push({ qKey, originalIndex: i, project: proj });
        });
    });

    const totalPipelineValue = allProjects
        .filter(p => p.project.temperature !== 'historico' && p.project.temperature !== 'perdido')
        .reduce((acc, p) => acc + (p.project.value || 0), 0);

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <span className="bg-indigo-500/10 text-indigo-400 font-mono text-sm px-3 py-1 rounded-full border border-indigo-500/20">
                        {allProjects.length} Projetos no total
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1 flex items-center justify-end gap-1">
                        Total Auto-calculado
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger type="button">
                                    <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[280px] text-zinc-200 leading-relaxed">
                                    Soma do valor em Reais de todas as oportunidades ativas (exclui projetos desativados/perdidos/históricos).
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </p>
                    <p className="text-xl font-bold text-brand-pipeline font-mono">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPipelineValue)}
                    </p>
                </div>
            </div>

            {allProjects.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-950/50">
                    <p className="text-zinc-500 mb-4 font-medium">Nenhum projeto registrado.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {allProjects.map((item, idx) => (
                        <div key={`${item.qKey}-${item.originalIndex}-${idx}`} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center relative group hover:border-zinc-700 transition-colors">

                            {/* Form Grid */}
                            <div className="flex-1 w-full flex flex-col justify-center">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 w-full">
                                    <div className="space-y-1.5 md:col-span-1">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Período</label>
                                        <select
                                            className="h-9 w-full px-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs"
                                            value={item.qKey}
                                            onChange={(e) => handleMove(item.qKey, e.target.value as QuarterKey, item.originalIndex)}
                                        >
                                            <option value="q1">Q1</option>
                                            <option value="q2">Q2</option>
                                            <option value="q3">Q3</option>
                                            <option value="q4">Q4</option>
                                            <option value="nao_mapeado">N/M</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase flex items-center justify-between">
                                            Início Fat.
                                        </label>
                                        <select
                                            className="h-9 w-full px-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs"
                                            value={item.project.billingStartMonth || 0}
                                            onChange={(e) => handleUpdate(item.qKey, item.originalIndex, 'billingStartMonth', parseInt(e.target.value) || undefined)}
                                        >
                                            <option value={0}>Automatic (Qtr)</option>
                                            <option value={1}>01 - Janeiro</option>
                                            <option value={2}>02 - Fevereiro</option>
                                            <option value={3}>03 - Março</option>
                                            <option value={4}>04 - Abril</option>
                                            <option value={5}>05 - Maio</option>
                                            <option value={6}>06 - Junho</option>
                                            <option value={7}>07 - Julho</option>
                                            <option value={8}>08 - Agosto</option>
                                            <option value={9}>09 - Setembro</option>
                                            <option value={10}>10 - Outubro</option>
                                            <option value={11}>11 - Novembro</option>
                                            <option value={12}>12 - Dezembro</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Órgão</label>
                                        <Input value={item.project.orgao || ''} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'orgao', e.target.value)} placeholder="Ex: PGM" className="bg-zinc-900 border-zinc-800 text-sm h-9 px-2" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Oportunidade</label>
                                        <Input value={item.project.name} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'name', e.target.value)} placeholder="Nome do Projeto" className="bg-zinc-900 border-zinc-800 text-sm h-9 px-2" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Valor Total (R$)</label>
                                        <Input type="number" step="0.01" value={item.project.value} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'value', parseFloat(e.target.value))} className="bg-zinc-900 border-zinc-800 text-sm h-9 font-mono px-2" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-1">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Vigência</label>
                                        <Input type="number" min="1" value={item.project.durationMonths ?? 12} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'durationMonths', parseInt(e.target.value) || 12)} className="bg-zinc-900 border-zinc-800 text-sm h-9 font-mono px-1.5 text-center" placeholder="12m" title="Número de parcelas / meses de vigência" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Temp / Status</label>
                                        <select
                                            value={item.project.temperature || 'morno'}
                                            onChange={e => handleUpdate(item.qKey, item.originalIndex, 'temperature', e.target.value)}
                                            className="flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="quente">🔥 Quente</option>
                                            <option value="morno">🟡 Morno</option>
                                            <option value="frio">❄️ Frio</option>
                                            <option value="contratado">✅ Contratado</option>
                                            <option value="historico">⏸️ Adiado</option>
                                            <option value="perdido">❌ Perdido</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Pro-Rata Breakdown info if Contratado */}
                                {item.project.temperature === 'contratado' && (
                                    <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>Contrato Fechado</span>
                                            <span className="text-zinc-400 font-normal">• Vigência: {item.project.durationMonths || 12} meses</span>
                                            <span className="text-zinc-400 font-normal">• Mensalidade: {formatCurrency((item.project.value || 0) / (item.project.durationMonths || 12))}/mês</span>
                                        </div>
                                        <div className="font-bold font-mono text-blue-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 flex items-center gap-1.5">
                                            <span>Reconhecido em 2026: {formatCurrency(calculateProject2026Value(item.project, item.qKey))}</span>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger type="button">
                                                        <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="text-zinc-200 max-w-[280px] leading-relaxed">
                                                        <strong>Cálculo Pro-Rata 2026:</strong><br />(Valor Total ÷ Vigência) × Meses vigentes em 2026 a partir do mês de início de faturamento.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>
                                )}

                                {/* Description Row */}
                                <div className="space-y-1.5 mt-3">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Descrição (Opcional)</label>
                                    <Input value={item.project.description || ''} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'description', e.target.value)} placeholder="Detalhes, próximos passos ou status..." className="bg-zinc-900 border-zinc-800 text-sm h-9 px-2" />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 self-stretch md:self-auto ml-2 border-t border-zinc-800 md:border-0 pt-3 md:pt-4">
                                <Button
                                    size="sm"
                                    type="button"
                                    title="Histórico de Alterações"
                                    className={`w-12 flex-shrink-0 h-9 px-0 relative ${
                                        (item.project.history?.length ?? 0) > 0
                                            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                                    }`}
                                    onClick={() => setHistoryModalTarget({ qKey: item.qKey, index: item.originalIndex, project: item.project })}
                                >
                                    <History className="w-4 h-4 mx-auto" />
                                    {(item.project.history?.length ?? 0) > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-zinc-950 font-bold font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                                            {item.project.history!.length}
                                        </span>
                                    )}
                                </Button>
                                <Button size="sm" type="button" title="Duplicar Projeto" className="w-12 flex-shrink-0 bg-indigo-950/50 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-900/50 h-9 px-0" onClick={() => handleDuplicate(item.qKey, item.originalIndex)}>
                                    <Copy className="w-4 h-4 mx-auto" />
                                </Button>
                                <Button size="sm" type="button" title="Excluir Projeto" variant="destructive" className="w-12 flex-shrink-0 bg-red-950/50 hover:bg-red-900 text-red-400 border border-red-900/50 h-9 px-0" onClick={() => handleDelete(item.qKey, item.originalIndex)}>
                                    <Trash2 className="w-4 h-4 mx-auto" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Button onClick={handleAdd} variant="outline" className="w-full mt-2 h-12 border-dashed border-2 border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400 text-zinc-400 font-semibold bg-transparent transition-all">
                <Plus className="w-5 h-5 mr-2" />
                Criar Novo Projeto
            </Button>

            {/* Modal de Histórico */}
            {historyModalTarget && (
                <ProjectHistoryModal
                    open={Boolean(historyModalTarget)}
                    onClose={() => setHistoryModalTarget(null)}
                    project={historyModalTarget.project}
                    quarterKey={historyModalTarget.qKey}
                    onSaveHistory={(newHistory: ProjectHistoryItem[]) => {
                        handleUpdate(historyModalTarget.qKey, historyModalTarget.index, 'history', newHistory);
                    }}
                />
            )}
        </div>
    );
}
