import { Project, QuarterData, PipelineData, Manager } from '@/types/manager';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';

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

    const totalPipelineValue = allProjects.reduce((acc, p) => acc + (p.project.value || 0), 0);

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <span className="bg-indigo-500/10 text-indigo-400 font-mono text-sm px-3 py-1 rounded-full border border-indigo-500/20">
                        {allProjects.length} Projetos no total
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Total Auto-calculado</p>
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
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Período</label>
                                        <select
                                            className="h-9 w-full px-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Órgão</label>
                                        <Input value={item.project.orgao || ''} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'orgao', e.target.value)} placeholder="Ex: PGM" className="bg-zinc-900 border-zinc-800 text-sm h-9 px-2" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-3">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Oportunidade</label>
                                        <Input value={item.project.name} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'name', e.target.value)} placeholder="Nome do Projeto" className="bg-zinc-900 border-zinc-800 text-sm h-9 px-2" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-3">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Valor (R$)</label>
                                        <Input type="number" step="0.01" value={item.project.value} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'value', parseFloat(e.target.value))} className="bg-zinc-900 border-zinc-800 text-sm h-9 font-mono px-2" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Temp</label>
                                        <select
                                            value={item.project.temperature || 'morno'}
                                            onChange={e => handleUpdate(item.qKey, item.originalIndex, 'temperature', e.target.value)}
                                            className="flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="quente">🔥</option>
                                            <option value="morno">🟡</option>
                                            <option value="frio">❄️</option>
                                            <option value="contratado">✅ Contratado</option>
                                            <option value="historico">⏸️ Adiado</option>
                                            <option value="perdido">❌ Perdido</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Description Row */}
                                <div className="space-y-1.5 mt-4">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Descrição (Opcional)</label>
                                    <Input value={item.project.description || ''} onChange={e => handleUpdate(item.qKey, item.originalIndex, 'description', e.target.value)} placeholder="Detalhes, próximos passos ou status..." className="bg-zinc-900 border-zinc-800 text-sm h-9 px-2" />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 self-stretch md:self-auto ml-2 border-t border-zinc-800 md:border-0 pt-3 md:pt-4">
                                <Button size="sm" className="w-12 flex-shrink-0 bg-indigo-950/50 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-900/50 h-9 px-0" onClick={() => handleDuplicate(item.qKey, item.originalIndex)}>
                                    <Copy className="w-4 h-4 mx-auto" />
                                </Button>
                                <Button size="sm" variant="destructive" className="w-12 flex-shrink-0 bg-red-950/50 hover:bg-red-900 text-red-400 border border-red-900/50 h-9 px-0" onClick={() => handleDelete(item.qKey, item.originalIndex)}>
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
        </div>
    );
}
