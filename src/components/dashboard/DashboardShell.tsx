'use client';

import { useState, useMemo, useEffect } from 'react';
import { Manager } from '@/types/manager';
import { fetchManagers } from '@/services/managers.service';
import { SingleManagerView } from './SingleManagerView';
import { DRMOverview } from './DRMOverview';
import { MapPin, Users, Loader2, Building2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateAchievementPercentage, determinePerformanceStatus } from '@/lib/calc';
import { StatBadge } from './StatBadge';

export function DashboardShell() {
    const [managers, setManagers] = useState<Manager[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters & State
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch Data
    useEffect(() => {
        const loadManagers = async () => {
            try {
                setIsLoading(true);
                const data = await fetchManagers();
                setManagers(data);

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

    // Compute Years
    const availableYears = useMemo(() => {
        return Array.from(new Set(managers.map(m => m.year))).sort((a, b) => b - a);
    }, [managers]);

    // Filter managers by selected year
    const managersForYear = useMemo(() => {
        return managers.filter(m => m.year.toString() === selectedYear);
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
        return <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-red-500">{error}</div>;
    }

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p>Carregando Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-zinc-950 text-zinc-50 flex flex-col overflow-hidden selection:bg-indigo-500/30">
            {/* Header - Fixed Height */}
            <header className="flex-none p-4 sm:p-6 lg:px-8 border-b border-zinc-900/50 bg-zinc-950 backdrop-blur-sm z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <MapPin className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                            Dashboard Comercial
                        </h1>
                        <p className="text-zinc-400 text-sm font-medium">
                            Visão Executiva de Gerentes
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-28">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 focus:ring-zinc-700 h-10">
                                <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                {availableYears.map((year) => (
                                    <SelectItem key={year} value={year.toString()} className="focus:bg-zinc-800 focus:text-zinc-50">
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
                                    const achievement = calculateAchievementPercentage(manager.forecastFinal, manager.meta);
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
                                                <div>
                                                    <p className="font-semibold text-zinc-100 text-lg">{manager.name}</p>
                                                    <p className="text-sm text-zinc-400">{manager.role}</p>
                                                </div>
                                            </div>
                                            <StatBadge status={status} />
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
                </div>
            </header>

            {/* Main Content Area - Scroll hidden in root, handles remaining height */}
            <main className="flex-1 min-h-0 p-4 sm:p-6 lg:px-8 flex flex-col w-full max-w-7xl mx-auto overflow-hidden">
                {selectedManagerId === 'drm' ? (
                    <DRMOverview managers={managersForYear} year={selectedYear} />
                ) : currentManager ? (
                    <SingleManagerView manager={currentManager} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl">
                        <Users className="w-12 h-12 mb-4 text-zinc-700" />
                        <p className="text-lg font-medium">Selecione um gerente para visualizar.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
