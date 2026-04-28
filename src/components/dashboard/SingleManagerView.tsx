'use client';

import { useState, useEffect } from 'react';
import { Manager, CXItem, Visit } from '@/types/manager';
import { calcEffectiveContratado } from '@/lib/calc';
import { ManagerHeader } from './ManagerHeader';
import { PerformanceBars } from './PerformanceBars';
import { PipelineBars } from './PipelineBars';
import { ForecastKpis } from './ForecastKpis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsTab } from './tabs/ProjectsTab';
import { CXTab } from './tabs/CXTab';
import { VisitsTab } from './tabs/VisitsTab';
import { ClientsTab } from './tabs/ClientsTab';
import { getCXByManager, getVisitsByManager } from '@/app/settings/fetchActions';
import { Loader2, Building2 } from 'lucide-react';

interface SingleManagerViewProps {
    manager: Manager;
}

export function SingleManagerView({ manager }: SingleManagerViewProps) {
    const effectiveContratado = calcEffectiveContratado(manager.contratado, manager.pipeline);
    const [cxItems, setCxItems] = useState<CXItem[] | null>(null);
    const [visits, setVisits] = useState<Visit[] | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');

    // Lazy-load CX and Visits only when tab is first accessed
    useEffect(() => {
        if ((activeTab === 'cx' || activeTab === 'visitas') && cxItems === null) {
            getCXByManager(manager.id).then(setCxItems);
        }
        if (activeTab === 'visitas' && visits === null) {
            getVisitsByManager(manager.id).then(setVisits);
        }
    }, [activeTab, manager.id]);

    // Reset when manager changes
    useEffect(() => {
        setCxItems(null);
        setVisits(null);
        setActiveTab('dashboard');
    }, [manager.id]);

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:h-full gap-0">
            {/* Tab Bar */}
            <TabsList className="w-full grid grid-cols-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl mb-6 shrink-0">
                <TabsTrigger
                    value="dashboard"
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400 rounded-xl"
                >
                    📊 Info
                </TabsTrigger>
                <TabsTrigger
                    value="clientes"
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400 rounded-xl"
                >
                    🏢 Clientes
                </TabsTrigger>
                <TabsTrigger
                    value="projetos"
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400 rounded-xl"
                >
                    📋 Projetos
                </TabsTrigger>
                <TabsTrigger
                    value="cx"
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400 rounded-xl"
                >
                    🤝 CX
                </TabsTrigger>
                <TabsTrigger
                    value="visitas"
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400 rounded-xl"
                >
                    📍 Visitas
                </TabsTrigger>
            </TabsList>

            {/* ── Dashboard (original view) ── */}
            <TabsContent value="dashboard" className="flex flex-col lg:h-full gap-6 pb-6 lg:min-h-0 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-1/2 min-h-[300px]">
                    <div className="lg:col-span-12 flex flex-col gap-6 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
                        <ManagerHeader manager={manager} />
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-full">
                                <ForecastKpis contratado={effectiveContratado} meta={manager.meta} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-1/2 min-h-[300px]">
                    <div className="lg:col-span-5 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-center backdrop-blur-md">
                        <h4 className="text-lg font-medium text-zinc-400 mb-6">Desempenho da Meta</h4>
                        <PerformanceBars meta={manager.meta} contratado={effectiveContratado} />
                    </div>
                    <div className="lg:col-span-7 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 sm:p-8 backdrop-blur-md flex flex-col min-h-0 min-h-[300px] lg:min-h-0">
                        <PipelineBars pipeline={manager.pipeline} managerName={manager.name} />
                    </div>
                </div>
            </TabsContent>

            {/* ── Clientes ── */}
            <TabsContent value="clientes" className="mt-0">
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md h-[400px] lg:h-[600px] overflow-y-auto custom-scrollbar">
                    <h4 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                        <Building2 className="w-6 h-6 text-indigo-400" />
                        Órgãos e Instituições Atendidas
                    </h4>
                    <ClientsTab clients={manager.servedClients} />
                </div>
            </TabsContent>

            {/* ── Projetos ── */}
            <TabsContent value="projetos" className="mt-0">
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
                    <h4 className="text-lg font-semibold text-zinc-200 mb-6">Pipeline de Projetos</h4>
                    <ProjectsTab pipeline={manager.pipeline} />
                </div>
            </TabsContent>

            {/* ── CX ── */}
            <TabsContent value="cx" className="mt-0">
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
                    <h4 className="text-lg font-semibold text-zinc-200 mb-6">Registros de CX</h4>
                    {cxItems === null ? (
                        <div className="flex items-center justify-center py-20 text-zinc-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                        </div>
                    ) : (
                        <CXTab items={cxItems} />
                    )}
                </div>
            </TabsContent>

            {/* ── Visitas ── */}
            <TabsContent value="visitas" className="mt-0">
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
                    <h4 className="text-lg font-semibold text-zinc-200 mb-6">Visitas Realizadas</h4>
                    {visits === null ? (
                        <div className="flex items-center justify-center py-20 text-zinc-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                        </div>
                    ) : (
                        <VisitsTab items={visits} />
                    )}
                </div>
            </TabsContent>
        </Tabs>
    );
}
