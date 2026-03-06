import { Project, QuarterData, OpportunityTemperature, Manager } from '@/types/manager';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { sumQuarterProjects } from '@/lib/calc';

interface Props {
    qKey: 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado';
    quarterData: QuarterData;
    manager: Manager;
    onChange: (qData: QuarterData) => void;
    onMoveProject?: (toQ: string, projectIndex: number) => void;
}

export function QuarterEditor({ qKey, quarterData, manager, onChange, onMoveProject }: Props) {

    // Auto sync total
    const updateProjects = (newProjects: Project[]) => {
        onChange({
            total: sumQuarterProjects(newProjects),
            projects: newProjects
        });
    }

    const handleAdd = () => {
        const newProj: Project = { name: 'Novo Projeto', orgao: '', value: 0, temperature: 'morno' };
        updateProjects([...quarterData.projects, newProj]);
    };

    const handleUpdate = (index: number, field: keyof Project, val: any) => {
        const clone = [...quarterData.projects];
        clone[index] = { ...clone[index], [field]: val };
        updateProjects(clone);
    };

    const handleDelete = (index: number) => {
        const clone = [...quarterData.projects];
        clone.splice(index, 1);
        updateProjects(clone);
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <h4 className="text-zinc-300 font-semibold text-lg uppercase">
                        {qKey === 'nao_mapeado' ? 'Oportunidades Não Mapeadas' : `Oportunidades ${qKey}`}
                    </h4>
                    <span className="bg-indigo-500/10 text-indigo-400 font-mono text-sm px-3 py-1 rounded-full border border-indigo-500/20">
                        {quarterData.projects.length} Projetos
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Total Auto-calculado</p>
                    <p className="text-xl font-bold text-brand-pipeline font-mono">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quarterData.total)}
                    </p>
                </div>
            </div>

            {quarterData.projects.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-950/50">
                    <p className="text-zinc-500 mb-4 font-medium">Nenhum projeto neste trimestre.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {quarterData.projects.map((p, idx) => (
                        <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center relative group">

                            {/* Form Grid */}
                            <div className="flex-1 w-full flex flex-col justify-center">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">

                                    <div className="space-y-1.5 md:col-span-3">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Órgão</label>
                                        <Input value={p.orgao || ''} onChange={e => handleUpdate(idx, 'orgao', e.target.value)} placeholder="Ex: PGM" className="bg-zinc-900 border-zinc-800 text-sm h-9" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-4">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Oportunidade</label>
                                        <Input value={p.name} onChange={e => handleUpdate(idx, 'name', e.target.value)} placeholder="Nome do Projeto" className="bg-zinc-900 border-zinc-800 text-sm h-9" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-3">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Valor (R$)</label>
                                        <Input type="number" step="0.01" value={p.value} onChange={e => handleUpdate(idx, 'value', parseFloat(e.target.value))} className="bg-zinc-900 border-zinc-800 text-sm h-9 font-mono" />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Temp</label>
                                        <select
                                            value={p.temperature || 'morno'}
                                            onChange={e => handleUpdate(idx, 'temperature', e.target.value)}
                                            className="flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="quente">🔥 Quente</option>
                                            <option value="morno">🟡 Morno</option>
                                            <option value="frio">❄️ Frio</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Description Row */}
                                <div className="space-y-1.5 mt-4">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Descrição (Opcional)</label>
                                    <Input value={p.description || ''} onChange={e => handleUpdate(idx, 'description', e.target.value)} placeholder="Detalhes, próximos passos ou status..." className="bg-zinc-900 border-zinc-800 text-sm h-9" />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0 pt-3 md:pt-5 border-t border-zinc-800 md:border-0 self-stretch md:self-auto">
                                <select
                                    className="h-9 px-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 text-xs outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:flex-none cursor-pointer"
                                    value={qKey}
                                    onChange={(e) => {
                                        if (e.target.value !== qKey && onMoveProject) {
                                            onMoveProject(e.target.value, idx);
                                        }
                                    }}
                                >
                                    <option value="q1">Mover p/ Q1</option>
                                    <option value="q2">Mover p/ Q2</option>
                                    <option value="q3">Mover p/ Q3</option>
                                    <option value="q4">Mover p/ Q4</option>
                                    <option value="nao_mapeado">Mover p/ Não Mapeado</option>
                                </select>
                                <Button size="sm" variant="destructive" className="w-12 flex-shrink-0 bg-red-950/50 hover:bg-red-900 text-red-400 border border-red-900/50 h-9 px-0" onClick={() => handleDelete(idx)}>
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
