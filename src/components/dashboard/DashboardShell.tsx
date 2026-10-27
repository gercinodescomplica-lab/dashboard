'use client';

import { useState, useMemo, useEffect } from 'react';
import { Manager } from '@/types/manager';
import { fetchDashboardManagers } from '@/services/managers.service';
import { getStoreProducts, getDropdownOptions } from '@/app/pipeline/actions';
import { getFaturamento2025Action } from '@/app/settings/actions';
import { SingleManagerView } from './SingleManagerView';
import { DRMOverview } from './DRMOverview';
import StoreView from './StoreView';
import { Users, Loader2, Building2 } from 'lucide-react';
import OrganizationChartView from './OrganizationChartView';
import PipelineStoreView from './PipelineStoreView';
import { CidadesView } from '@/components/cidades/CidadesView';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateAchievementPercentage, determinePerformanceStatus, sumPipelineContratado2026 } from '@/lib/calc';
import { applyBodyTheme } from '@/lib/themeSync';
import { useVersaoGrcc } from '@/hooks/useVersaoGrcc';
import { StatBadge } from './StatBadge';
import { AppHeader, VISOES_APP, type VisaoApp } from '@/components/layout/AppHeader';

export function DashboardShell() {
    const [managers, setManagers] = useState<Manager[]>([]);
    const [storeProducts, setStoreProducts] = useState<any[]>([]);
    const [dropdownOpts, setDropdownOpts] = useState<Record<string, string[]>>({});
    const [faturamento2025, setFaturamento2025] = useState<number>(630386397.11);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters & State
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'dashboard' | 'store' | 'organograma' | 'pipeline' | 'cidades'>('dashboard');
    // Tema claro/escuro do painel Pipeline Store, compartilhado com o cabeçalho (só reflete aqui quando essa aba está ativa).
    const [storeTheme, setStoreThemeState] = useState<'dark' | 'light'>('dark');
    // Áreas cobertas pelo mesmo botão do header (Dashboard, Cidades, Organograma, Store). Contratos/Propostas são páginas
    // separadas e têm seu próprio botão independente — não compartilham esse estado.
    const storeLightActive = ['dashboard', 'cidades', 'organograma', 'pipeline', 'store'].includes(currentView) && storeTheme === 'light';

    // Persiste a preferência de tema no navegador para sobreviver a atualizações de página (F5).
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const view = params.get('view');
            if (view && (VISOES_APP as string[]).includes(view)) setCurrentView(view as VisaoApp);
            if (params.get('trocarGerente') === '1') setIsModalOpen(true);
        } catch {}
        try {
            const saved = localStorage.getItem('aibertinho-theme');
            if (saved === 'light' || saved === 'dark') {
                setStoreThemeState(saved);
                applyBodyTheme(saved);
                return;
            }
        } catch {
            // localStorage indisponível (SSR/privacidade) — mantém o padrão escuro.
        }
        applyBodyTheme('dark');
    }, []);

    const setStoreTheme = (value: 'dark' | 'light' | ((prev: 'dark' | 'light') => 'dark' | 'light')) => {
        setStoreThemeState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            try {
                localStorage.setItem('aibertinho-theme', next);
            } catch {
                // localStorage indisponível — segue apenas em memória.
            }
            applyBodyTheme(next);
            return next;
        });
    };

    // Fetch Data
    useEffect(() => {
        const loadManagers = async () => {
            try {
                setIsLoading(true);
                const data = await fetchDashboardManagers();
                setManagers(data);
                const [products, opts, fat2025] = await Promise.all([
                    getStoreProducts(),
                    getDropdownOptions(),
                    getFaturamento2025Action(),
                ]);
                setStoreProducts(products);
                setDropdownOpts(opts);
                if (fat2025) setFaturamento2025(fat2025);

                if (data.length > 0) {
                    const maxYear = Math.max(...data.map(m => m.year));
                    setSelectedYear(maxYear.toString());
                }
            } catch (err) {
                setError('Falha ao carregar os dados dos gerentes.');
            } finally {
                setIsLoading(false);
            }
        };
        loadManagers();
    }, []);

    // Ao vivo: quando a GRCC grava leads, o pipeline da Débora muda — recarrega só os gerentes,
    // sem spinner e sem perder ano/gerente/visão selecionados.
    useVersaoGrcc(async () => {
        try {
            setManagers(await fetchDashboardManagers());
        } catch {
            // silencioso: o dado atual continua na tela
        }
    });

    // Compute Years
    const availableYears = useMemo(() => {
        return Array.from(new Set(managers.map(m => m.year))).sort((a, b) => b - a);
    }, [managers]);

    // Filter and sort managers by selected year and role hierarchy
    const managersForYear = useMemo(() => {
        return managers
            .filter(m => m.year.toString() === selectedYear)
            .sort((a, b) => {
                const parseRole = (role: string) => {
                    const match = role.toUpperCase().match(/^([A-Z]+)\s*(\d*)/);
                    if (!match) return { order: 99, num: 0 };

                    const prefix = match[1];
                    let order = 99;
                    if (prefix === 'KAM') order = 1;
                    else if (prefix === 'GRC') order = 2;
                    else if (prefix === 'GER') order = 3;

                    return { order, num: parseInt(match[2] || '0', 10) };
                };

                const rankA = parseRole(a.role);
                const rankB = parseRole(b.role);

                if (rankA.order !== rankB.order) return rankA.order - rankB.order;
                return rankA.num - rankB.num;
            });
    }, [managers, selectedYear]);

    // Auto-select first manager when year changes or data loads
    useEffect(() => {
        if (managersForYear.length > 0) {
            // Only reset if current selected manager is not in the list for this year and is not 'drm'
            const currentExists = managersForYear.find(m => m.id === selectedManagerId);
            if (!currentExists && selectedManagerId !== 'drm') {
                setSelectedManagerId('drm'); // Default to DRM view initially
            }
        } else {
            setSelectedManagerId(null);
        }
    }, [managersForYear, selectedManagerId]);

    const currentManager = useMemo(() => {
        return managersForYear.find(m => m.id === selectedManagerId) || null;
    }, [managersForYear, selectedManagerId]);

    if (error) {
        return <div className={`h-screen w-screen flex items-center justify-center transition-colors duration-200 ${storeLightActive ? 'bg-white' : 'bg-zinc-950'} text-red-500`}>{error}</div>;
    }

    if (isLoading) {
        return (
            <div className={`h-screen w-screen flex flex-col items-center justify-center gap-4 transition-colors duration-200 ${storeLightActive ? 'bg-white text-zinc-500' : 'bg-zinc-950 text-zinc-400'}`}>
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p>Carregando Dashboard...</p>
            </div>
        );
    }

    return (
        <div className={`h-screen w-screen ${storeLightActive ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-50'} flex flex-col overflow-hidden selection:bg-indigo-500/30 transition-colors duration-200`}>

            {/* Header - Fixed Height */}
            <AppHeader
                claro={storeLightActive}
                onAlternarTema={() => setStoreTheme(t => t === 'dark' ? 'light' : 'dark')}
                visaoAtual={currentView}
                onNavegar={setCurrentView}
                onLogo={() => setSelectedManagerId('drm')}
            >
                    <div className="w-28">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className={storeLightActive ? 'bg-white border-zinc-200 focus:ring-zinc-300 h-10' : 'bg-zinc-900 border-zinc-800 focus:ring-zinc-700 h-10'}>
                                <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                            <SelectContent className={storeLightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100'}>
                                {availableYears.map((year) => (
                                    <SelectItem key={year} value={year.toString()} className={storeLightActive ? 'focus:bg-zinc-100 focus:text-zinc-900' : 'focus:bg-zinc-800 focus:text-zinc-50'}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogTrigger asChild>
                            <button className="flex items-center gap-2 h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors text-sm">
                                <Users className="w-4 h-4" />
                                Trocar Gerente
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold">Selecione a Visão ({selectedYear})</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-3">
                                {/* DRM Option */}
                                <button
                                    onClick={() => {
                                        setSelectedManagerId('drm');
                                        setIsModalOpen(false);
                                    }}
                                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between
                        ${selectedManagerId === 'drm' ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'}
                      `}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 flex items-center justify-center">
                                            <Building2 className="w-6 h-6 text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-zinc-100 text-lg">Diretoria de Mercado</p>
                                            <p className="text-sm text-zinc-400">Visão Geral (DRM)</p>
                                        </div>
                                    </div>
                                </button>

                                <div className="h-px bg-zinc-800/50 my-2" />

                                {managersForYear.map(manager => {
                                    const novos = manager.novosNegocios ?? sumPipelineContratado2026(manager.pipeline);
                                    const achievement = calculateAchievementPercentage(novos, manager.meta);
                                    const status = determinePerformanceStatus(achievement);
                                    const isSelected = manager.id === selectedManagerId;

                                    return (
                                        <button
                                            key={manager.id}
                                            onClick={() => {
                                                setSelectedManagerId(manager.id);
                                                setIsModalOpen(false);
                                            }}
                                            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between
                        ${isSelected ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'}
                      `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                                                    {manager.avatarUrl && !manager.avatarUrl.includes('placeholder') ? (
                                                        <img src={manager.avatarUrl} alt={manager.name} className="w-full h-full object-cover object-top" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-zinc-500">{manager.name.charAt(0)}</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 flex items-center ml-2">
                                                    <div className="text-left">
                                                        <p className="font-semibold text-zinc-100 text-lg">{manager.name}</p>
                                                        <p className="text-sm text-zinc-400">{manager.role}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                                {managersForYear.length === 0 && (
                                    <div className="text-center py-8 text-zinc-500">
                                        Nenhum gerente encontrado para este ano.
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
            </AppHeader>

            {/* Main Content Area - Scrollable on mobile, handles remaining height */}
            <main className="relative flex-1 min-h-0 p-4 sm:p-6 lg:px-8 flex flex-col w-full overflow-y-auto overflow-x-hidden z-10">
                {currentView === 'cidades' ? (
                    <CidadesView lightActive={storeLightActive} />
                ) : currentView === 'organograma' ? (
                    <OrganizationChartView lightActive={storeLightActive} />
                ) : currentView === 'pipeline' ? (
                    <PipelineStoreView PRODUCTS={storeProducts} EXTRA_OPTIONS={dropdownOpts} theme={storeTheme} onThemeChange={setStoreTheme} />
                ) : currentView === 'store' ? (
                    <StoreView />
                ) : selectedManagerId === 'drm' ? (
                    <DRMOverview key={`drm-${selectedYear}`} managers={managersForYear} year={selectedYear} faturamento2025={faturamento2025} lightActive={storeLightActive} />
                ) : currentManager ? (
                    <SingleManagerView key={currentManager.id} manager={currentManager} lightActive={storeLightActive} />
                ) : (
                    <div className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-colors duration-200 ${storeLightActive ? 'text-zinc-500 border-zinc-300' : 'text-zinc-500 border-zinc-800'}`}>
                        <Users className={`w-12 h-12 mb-4 ${storeLightActive ? 'text-zinc-300' : 'text-zinc-700'}`} />
                        <p className="text-lg font-medium">Selecione um gerente para visualizar.</p>
                    </div>
                )}
            </main >
        </div >
    );
}
