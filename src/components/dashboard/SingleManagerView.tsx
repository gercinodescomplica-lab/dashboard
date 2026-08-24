'use client';

import { useState, useEffect } from 'react';
import { Manager, CXItem, Visit } from '@/types/manager';
import { calcEffectiveContratado, sumPipelineContratado2026 } from '@/lib/calc';
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
    lightActive?: boolean;
}

export function SingleManagerView({ manager, lightActive = false }: SingleManagerViewProps) {
    const effectiveContratado = calcEffectiveContratado(manager.contratado, manager.pipeline);
    const novosNegocios = manager.novosNegocios ?? sumPipelineContratado2026(manager.pipeline);
    const [cxItems, setCxItems] = useState<CXItem[] | null>(null);
    const [visits, setVisits] = useState<Visit[] | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');

    const T = {
        tabBar: lightActive ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800',
        tabInactive: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        tabHover: lightActive ? 'hover:bg-zinc-200 hover:text-zinc-700' : 'hover:bg-zinc-800 hover:text-zinc-200',
        panel: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/30 border-zinc-800/80',
        heading: lightActive ? 'text-zinc-900' : 'text-white',
        subheading: lightActive ? 'text-zinc-600' : 'text-zinc-200',
        mutedHeading: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        loadingText: lightActive ? 'text-zinc-400' : 'text-zinc-500',
    };

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
            <TabsList className={`w-full grid grid-cols-5 border rounded-2xl mb-6 shrink-0 transition-colors duration-200 ${T.tabBar}`}>
                <TabsTrigger
                    value="dashboard"
                    className={`data-[state=active]:bg-indigo-600 data-[state=active]:text-white ${T.tabInactive} ${T.tabHover} rounded-xl`}
                >
                    📊 Info
                </TabsTrigger>
                <TabsTrigger
                    value="clientes"
                    className={`data-[state=active]:bg-indigo-600 data-[state=active]:text-white ${T.tabInactive} ${T.tabHover} rounded-xl`}
                >
                    🏢 Clientes
                </TabsTrigger>
                <TabsTrigger
                    value="projetos"
                    className={`data-[state=active]:bg-indigo-600 data-[state=active]:text-white ${T.tabInactive} ${T.tabHover} rounded-xl`}
                >
                    📋 Projetos
                </TabsTrigger>
                <TabsTrigger
                    value="cx"
                    className={`data-[state=active]:bg-indigo-600 data-[state=active]:text-white ${T.tabInactive} ${T.tabHover} rounded-xl`}
                >
                    🤝 CX
                </TabsTrigger>
                <TabsTrigger
                    value="visitas"
                    className={`data-[state=active]:bg-indigo-600 data-[state=active]:text-white ${T.tabInactive} ${T.tabHover} rounded-xl`}
                >
                    📍 Visitas
                </TabsTrigger>
            </TabsList>

            {/* ── Dashboard (original view) ── */}
            <TabsContent value="dashboard" className="flex flex-col lg:h-full gap-6 pb-6 lg:min-h-0 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-1/2 min-h-[300px]">
                    <div className={`lg:col-span-12 flex flex-col gap-6 border rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-colors duration-200 ${T.panel}`}>
                        <ManagerHeader manager={manager} lightActive={lightActive} />
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-full">
                                <ForecastKpis manager={manager} lightActive={lightActive} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-1/2 min-h-[300px]">
                    <div className={`lg:col-span-5 border rounded-2xl p-6 sm:p-8 flex flex-col justify-center backdrop-blur-md transition-colors duration-200 ${T.panel}`}>
                        <h4 className={`text-lg font-medium mb-6 ${T.mutedHeading}`}>Desempenho da Meta</h4>
                        <PerformanceBars meta={manager.meta} metaNovosNegocios={manager.metaNovosNegocios} novosNegocios={novosNegocios} lightActive={lightActive} />
                    </div>
                    <div className={`lg:col-span-7 border rounded-2xl p-4 sm:p-8 backdrop-blur-md flex flex-col min-h-0 min-h-[300px] lg:min-h-0 transition-colors duration-200 ${T.panel}`}>
                        <PipelineBars pipeline={manager.pipeline} managerName={manager.name} lightActive={lightActive} />
                    </div>
                </div>
            </TabsContent>

            {/* ── Clientes ── */}
            <TabsContent value="clientes" className="mt-0">
                <div className={`border rounded-2xl p-6 sm:p-8 backdrop-blur-md h-[400px] lg:h-[600px] overflow-y-auto custom-scrollbar transition-colors duration-200 ${T.panel}`}>
                    <h4 className={`text-xl font-semibold mb-6 flex items-center gap-3 ${T.heading}`}>
                        <Building2 className="w-6 h-6 text-indigo-400" />
                        Órgãos e Instituições Atendidas
                    </h4>
                    <ClientsTab clients={manager.servedClients} lightActive={lightActive} />
                </div>
            </TabsContent>

            {/* ── Projetos ── */}
            <TabsContent value="projetos" className="mt-0">
                <div className={`border rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-colors duration-200 ${T.panel}`}>
                    <h4 className={`text-lg font-semibold mb-6 ${T.subheading}`}>Pipeline de Projetos</h4>
                    <ProjectsTab pipeline={manager.pipeline} lightActive={lightActive} />
                </div>
            </TabsContent>

            {/* ── CX ── */}
            <TabsContent value="cx" className="mt-0">
                <div className={`border rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-colors duration-200 ${T.panel}`}>
                    <h4 className={`text-lg font-semibold mb-6 ${T.subheading}`}>Registros de CX</h4>
                    {cxItems === null ? (
                        <div className={`flex items-center justify-center py-20 ${T.loadingText}`}>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                        </div>
                    ) : (
                        <CXTab items={cxItems} lightActive={lightActive} />
                    )}
                </div>
            </TabsContent>

            {/* ── Visitas ── */}
            <TabsContent value="visitas" className="mt-0">
                <div className={`border rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-colors duration-200 ${T.panel}`}>
                    <h4 className={`text-lg font-semibold mb-6 ${T.subheading}`}>Visitas Realizadas</h4>
                    {visits === null ? (
                        <div className={`flex items-center justify-center py-20 ${T.loadingText}`}>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                        </div>
                    ) : (
                        <VisitsTab items={visits} lightActive={lightActive} />
                    )}
                </div>
            </TabsContent>
        </Tabs>
    );
}
