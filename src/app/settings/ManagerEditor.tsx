'use client';

import { useState, useEffect } from 'react';
import { Manager, CXItem, Visit, Pipeline } from '@/types/manager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Loader2, Calculator } from 'lucide-react';
import { PipelineEditor } from './PipelineEditor';
import { CXEditor } from './CXEditor';
import { VisitsEditor } from './VisitsEditor';
import { calculateForecastFinal } from '@/lib/calc';
import { getCXByManager, getVisitsByManager } from '@/app/settings/fetchActions';

interface Props {
    manager: Manager;
    onChange: (m: Manager) => void;
    onSave: () => void;
    isSaving: boolean;
}

export function ManagerEditor({ manager, onChange, onSave, isSaving }: Props) {
    const [loadingExtra, setLoadingExtra] = useState(true);

    useEffect(() => {
        if (manager.cx !== undefined && manager.visits !== undefined) {
            setLoadingExtra(false);
            return;
        }

        setLoadingExtra(true);
        Promise.all([
            getCXByManager(manager.id),
            getVisitsByManager(manager.id),
        ]).then(([cx, v]) => {
            onChange({ ...manager, cx, visits: v });
            setLoadingExtra(false);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (field: keyof Manager, value: any) => {
        onChange({ ...manager, [field]: value });
    };

    const handleUpdateQuarter = (qKey: 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado', currentQ: QuarterData) => {
        onChange({ ...manager, pipeline: { ...manager.pipeline, [qKey]: currentQ } });
    };

    const handleMoveProject = (fromQ: 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado', toQ: 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado', projectIndex: number) => {
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold">Editando Gerente</h1>
                    <p className="text-zinc-500">Informações, pipeline, visitas e CX de {manager.name}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:text-white" onClick={() => window.location.reload()}>
                        Cancelar
                    </Button>
                    <Button onClick={onSave} disabled={isSaving || loadingExtra} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar Tudo
                    </Button>
                </div>
            </div>

            {/* Tabs: Info + Pipeline + Visitas + CX */}
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-zinc-950 border border-zinc-800 mb-6">
                    <TabsTrigger value="info" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400">
                        Informações
                    </TabsTrigger>
                    <TabsTrigger value="visitas" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400">
                        📍 Visitas
                    </TabsTrigger>
                    <TabsTrigger value="cx" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400">
                        🤝 CX
                    </TabsTrigger>
                </TabsList>

                {/* ── Tab Informações Básicas + Pipeline ── */}
                <TabsContent value="info" className="flex flex-col gap-6">
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

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex-1 min-h-[500px]">
                        <h3 className="text-lg font-semibold mb-4 text-zinc-200">Pipeline & Projetos</h3>
                        <PipelineEditor
                            pipeline={manager.pipeline}
                            onChange={(newPipeline: Pipeline) => handleChange('pipeline', newPipeline)}
                        />
                    </div>
                </TabsContent>

                {/* ── Tab Visitas ── */}
                <TabsContent value="visitas">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[400px]">
                        {loadingExtra ? (
                            <div className="flex items-center justify-center py-20 text-zinc-500">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando visitas...
                            </div>
                        ) : (
                            <VisitsEditor items={manager.visits || []} onChange={(v) => handleChange('visits', v)} />
                        )}
                    </div>
                </TabsContent>

                {/* ── Tab CX ── */}
                <TabsContent value="cx">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[400px]">
                        {loadingExtra ? (
                            <div className="flex items-center justify-center py-20 text-zinc-500">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando CX...
                            </div>
                        ) : (
                            <CXEditor items={manager.cx || []} onChange={(cx) => handleChange('cx', cx)} />
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
