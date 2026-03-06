import { Manager, Project, QuarterData } from '@/types/manager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Loader2, Calculator } from 'lucide-react';
import { QuarterEditor } from './QuarterEditor';
import { calculateForecastFinal } from '@/lib/calc';

interface Props {
    manager: Manager;
    onChange: (m: Manager) => void;
    onSave: () => void;
    isSaving: boolean;
}

export function ManagerEditor({ manager, onChange, onSave, isSaving }: Props) {
    const handleChange = (field: keyof Manager, value: any) => {
        onChange({ ...manager, [field]: value });
    };

    const handleUpdateQuarter = (qKey: 'q1' | 'q2' | 'q3' | 'q4', currentQ: QuarterData) => {
        onChange({
            ...manager,
            pipeline: {
                ...manager.pipeline,
                [qKey]: currentQ
            }
        });
    }

    const handleMoveProject = (fromQ: 'q1' | 'q2' | 'q3' | 'q4', toQ: 'q1' | 'q2' | 'q3' | 'q4', projectIndex: number) => {
        if (fromQ === toQ) return;
        const newManager = { ...manager, pipeline: { ...manager.pipeline } };

        const sourceQuarter = { ...newManager.pipeline[fromQ], projects: [...newManager.pipeline[fromQ].projects] };
        const destQuarter = { ...newManager.pipeline[toQ], projects: [...newManager.pipeline[toQ].projects] };

        const [movedProject] = sourceQuarter.projects.splice(projectIndex, 1);
        destQuarter.projects.push(movedProject);

        sourceQuarter.total = sourceQuarter.projects.reduce((acc, p) => acc + p.value, 0);
        destQuarter.total = destQuarter.projects.reduce((acc, p) => acc + p.value, 0);

        newManager.pipeline[fromQ] = sourceQuarter;
        newManager.pipeline[toQ] = destQuarter;

        onChange(newManager);
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
            {/* Header & Button Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold">Editando Gerente</h1>
                    <p className="text-zinc-500">Altere informações básicas e pipeline de {manager.name}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:text-white" onClick={() => window.location.reload()}>
                        Cancelar
                    </Button>
                    <Button onClick={onSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar
                    </Button>
                </div>
            </div>

            {/* Basic Info */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-zinc-200">Informações Básicas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label>Nome Completo</Label>
                        <Input value={manager.name} onChange={e => handleChange('name', e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                    </div>
                    <div className="space-y-2">
                        <Label>Role (Ex: GRC1, KAM2)</Label>
                        <Input value={manager.role} onChange={e => handleChange('role', e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                    </div>
                    <div className="space-y-2">
                        <Label>Ano</Label>
                        <Input type="number" value={manager.year} onChange={e => handleChange('year', parseInt(e.target.value))} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                    </div>

                    <div className="space-y-2">
                        <Label>Meta Global (R$)</Label>
                        <Input type="number" step="0.01" value={manager.meta} onChange={e => handleChange('meta', parseFloat(e.target.value))} className="bg-zinc-950 border-zinc-800 text-zinc-400 font-mono" />
                    </div>
                    <div className="space-y-2">
                        <Label>Contratado (R$)</Label>
                        <Input type="number" step="0.01" value={manager.contratado} onChange={e => handleChange('contratado', parseFloat(e.target.value))} className="bg-zinc-950 border-zinc-800 text-zinc-400 font-mono" />
                    </div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            Forecast Final (R$)
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase tracking-tighter font-bold">Calculado</span>
                        </Label>
                        <div className="h-10 w-full flex items-center justify-between px-3 bg-zinc-950/50 border border-zinc-800 rounded-md text-indigo-400 font-mono font-bold text-sm">
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateForecastFinal(manager.contratado, manager.pipeline))}</span>
                            <Calculator className="w-3.5 h-3.5 text-zinc-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline Configs */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex-1 min-h-[500px]">
                <h3 className="text-lg font-semibold mb-4 text-zinc-200">Pipeline & Projetos</h3>

                <Tabs defaultValue="q1" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-zinc-950 border border-zinc-800 mb-6">
                        <TabsTrigger value="q1" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400">Q1 - 1º Tri</TabsTrigger>
                        <TabsTrigger value="q2" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400">Q2 - 2º Tri</TabsTrigger>
                        <TabsTrigger value="q3" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400">Q3 - 3º Tri</TabsTrigger>
                        <TabsTrigger value="q4" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400">Q4 - 4º Tri</TabsTrigger>
                    </TabsList>

                    {(['q1', 'q2', 'q3', 'q4'] as const).map(qKey => (
                        <TabsContent key={qKey} value={qKey}>
                            <QuarterEditor
                                qKey={qKey}
                                quarterData={manager.pipeline[qKey]}
                                manager={manager}
                                onChange={(newData: QuarterData) => handleUpdateQuarter(qKey, newData)}
                                onMoveProject={(toQ: string, idx: number) => handleMoveProject(qKey, toQ as any, idx)}
                            />
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    );
}
