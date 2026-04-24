"use client";

import React, { useState } from 'react';
import { LayoutDashboard, Calendar, Package, BarChart3, Building2 } from 'lucide-react';

export interface StoreProduct {
    id: number;
    n: string;
    d: string;
    s: string;
    f: string;
    mkt: boolean;
    cat: string;
}

const PHASES = [
    { f: 'Nov 2025', t: 'done', lb: 'produtos disponíveis' },
    { f: 'Dez 2025', t: 'done', lb: 'produtos disponíveis' },
    { f: 'Mar 2026', t: 'done', lb: 'produtos disponíveis' },
    { f: 'Abr 2026', t: 'in', lb: 'produtos em andamento', now: true },
    { f: 'Mai 2026', t: 'next', lb: 'próximos produtos' },
    { f: 'Jun 2026', t: 'next', lb: 'próximos produtos' },
    { f: 'Ago 2026', t: 'next', lb: 'próximos produtos' },
    { f: '—', t: 'backlog', lb: 'backlog' },
];

const DIR_COLORS: Record<string, string> = {
    DDS: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    DIT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    DRM: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    PRE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const DIR_DOT_COLORS: Record<string, string> = {
    DDS: 'bg-cyan-500', DIT: 'bg-amber-500', DRM: 'bg-emerald-500', PRE: 'bg-yellow-500'
};

const DIR_NAMES: Record<string, string> = {
    DDS: 'Desenvolvimento de Soluções Digitais',
    DIT: 'Infraestrutura e Tecnologia',
    DRM: 'Relacionamento de Mercado',
    PRE: 'Produtos e Resultados Estratégicos'
};

const STAT_COLORS = {
    store: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    breve: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    backlog: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50',
};

const STAT_LABELS = { store: 'Na Store', breve: 'Em breve', backlog: 'Backlog' };

export default function PipelineStoreView({ PRODUCTS = [] }: { PRODUCTS?: StoreProduct[] }) {
    const [view, setView] = useState<'overview' | 'roadmap' | 'produtos'>('overview');
    const [roadmapFilter, setRoadmapFilter] = useState('all');
    const [prodFilter, setProdFilter] = useState('all');
    const [selectedProdId, setSelectedProdId] = useState<number | null>(null);

    const storeProds = PRODUCTS.filter(p => p.s === 'store').length;
    const breveProds = PRODUCTS.filter(p => p.s === 'breve').length;
    const backProds = PRODUCTS.filter(p => p.s === 'backlog').length;

    const filteredRoadmapProds = roadmapFilter === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.d === roadmapFilter);
    const filteredTableProds = prodFilter === 'all'
        ? PRODUCTS
        : ['DDS', 'DIT', 'DRM', 'PRE'].includes(prodFilter)
            ? PRODUCTS.filter(p => p.d === prodFilter)
            : PRODUCTS.filter(p => p.s === prodFilter);

    const activeProd = PRODUCTS.find(p => p.id === selectedProdId);

    return (
        <div className="w-full h-full flex bg-zinc-950 text-zinc-100 rounded-2xl overflow-hidden border border-zinc-800">
            {/* Sidebar */}
            <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto hidden md:flex">
                <div className="p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg text-lg">P</div>
                        <div>
                            <div className="font-bold text-base leading-tight">Prodam Store</div>
                            <div className="text-[10px] text-indigo-400 tracking-wider uppercase mt-1">Gestão de Produto</div>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1 space-y-6">
                    <div>
                        <div className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-3 mb-2">Visão Geral</div>
                        <div className="space-y-1">
                            <button
                                onClick={() => setView('overview')}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'overview' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                            >
                                <BarChart3 className="w-4 h-4" />
                                Painel Geral
                            </button>
                            <button
                                onClick={() => setView('roadmap')}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'roadmap' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                            >
                                <Calendar className="w-4 h-4" />
                                Roadmap
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-3 mb-2">Produtos</div>
                        <button
                            onClick={() => setView('produtos')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'produtos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                        >
                            <Package className="w-4 h-4" />
                            Todos os Produtos
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
                    Novembro 2025 - 2026
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                <div className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur flex items-center px-6 justify-between flex-shrink-0">
                    <div className="font-bold text-lg text-zinc-100">
                        {view === 'overview' && 'Painel Geral'}
                        {view === 'roadmap' && 'Roadmap de Lançamentos'}
                        {view === 'produtos' && 'Listagem de Produtos'}
                    </div>
                    {/* Mobile nav quick toggles */}
                    <div className="md:hidden flex gap-2">
                         <button onClick={() => setView('overview')} className={`px-3 py-1.5 text-xs rounded-md ${view === 'overview' ? 'bg-zinc-800 text-white' : 'text-zinc-400 border border-zinc-800'}`}>Geral</button>
                         <button onClick={() => setView('roadmap')} className={`px-3 py-1.5 text-xs rounded-md ${view === 'roadmap' ? 'bg-zinc-800 text-white' : 'text-zinc-400 border border-zinc-800'}`}>Roadmap</button>
                         <button onClick={() => setView('produtos')} className={`px-3 py-1.5 text-xs rounded-md ${view === 'produtos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 border border-zinc-800'}`}>Produtos</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
                    {/* OVERVIEW */}
                    {view === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl border-l-4 border-l-indigo-500">
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total no portfólio</div>
                                    <div className="text-3xl font-black text-white">{PRODUCTS.length}</div>
                                    <div className="text-sm text-zinc-400 mt-1">produtos mapeados</div>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl border-l-4 border-l-emerald-500">
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Na Store</div>
                                    <div className="text-3xl font-black text-emerald-400">{storeProds}</div>
                                    <div className="text-sm text-zinc-400 mt-1">disponíveis hoje</div>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl border-l-4 border-l-amber-500">
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Em breve</div>
                                    <div className="text-3xl font-black text-amber-400">{breveProds}</div>
                                    <div className="text-sm text-zinc-400 mt-1">com previsão</div>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl border-l-4 border-l-zinc-500">
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Backlog</div>
                                    <div className="text-3xl font-black text-zinc-400">{backProds}</div>
                                    <div className="text-sm text-zinc-400 mt-1">sem data definida</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h3 className="text-sm font-bold text-zinc-300 mb-6 uppercase tracking-wider">Por Diretoria</h3>
                                    <div className="space-y-4">
                                        {['DDS', 'DIT', 'DRM', 'PRE'].map(dir => {
                                            const count = PRODUCTS.filter(p => p.d === dir).length;
                                            const pct = Math.round((count / PRODUCTS.length) * 100);
                                            return (
                                                <div key={dir}>
                                                    <div className="flex justify-between mb-1 text-sm">
                                                        <span className="font-bold flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${DIR_DOT_COLORS[dir]}`}></div>
                                                            {dir}
                                                        </span>
                                                        <span className="text-zinc-400">{count} ({pct}%)</span>
                                                    </div>
                                                    <div className="w-full bg-zinc-800 rounded-full h-2">
                                                        <div className={`h-2 rounded-full ${DIR_DOT_COLORS[dir]} opacity-80`} style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h3 className="text-sm font-bold text-zinc-300 mb-6 uppercase tracking-wider">Status</h3>
                                    <div className="space-y-4">
                                        {[
                                            { s: 'store', label: 'Na Store', color: 'bg-emerald-500', count: storeProds },
                                            { s: 'breve', label: 'Em breve', color: 'bg-amber-500', count: breveProds },
                                            { s: 'backlog', label: 'Backlog', count: backProds, color: 'bg-zinc-500' }
                                        ].map(stat => {
                                            const pct = Math.round((stat.count / PRODUCTS.length) * 100);
                                            return (
                                                <div key={stat.s}>
                                                    <div className="flex justify-between mb-1 text-sm">
                                                        <span className="font-bold flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${stat.color}`}></div>
                                                            {stat.label}
                                                        </span>
                                                        <span className="text-zinc-400">{stat.count} ({pct}%)</span>
                                                    </div>
                                                    <div className="w-full bg-zinc-800 rounded-full h-2">
                                                        <div className={`h-2 rounded-full ${stat.color} opacity-80`} style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ROADMAP */}
                    {view === 'roadmap' && (
                        <div>
                            <div className="flex flex-wrap gap-2 mb-8">
                                <span className="text-sm font-bold text-zinc-500 py-1.5 mr-2 uppercase">Filtrar:</span>
                                {['all', 'DDS', 'DIT', 'DRM', 'PRE'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setRoadmapFilter(f)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border ${roadmapFilter === f ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}
                                    >
                                        {f !== 'all' && <div className={`w-2 h-2 rounded-full ${DIR_DOT_COLORS[f]}`}></div>}
                                        {f === 'all' ? 'Todas' : f}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                {PHASES.map((ph, idx) => {
                                    const items = filteredRoadmapProds.filter(p => ph.t === 'backlog' ? p.s === 'backlog' : p.f === ph.f);

                                    return (
                                        <div key={idx} className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                            {/* Phase Info */}
                                            <div className="sm:w-36 flex-shrink-0 flex items-center sm:items-end justify-between sm:justify-start sm:flex-col pt-3 border-b-2 sm:border-b-0 border-zinc-800 pb-2 sm:pb-0">
                                                <div className="font-bold text-zinc-200 text-sm sm:text-right flex items-center gap-2 sm:block sm:mb-1">
                                                    {ph.f}
                                                    {ph.now && <span className="px-2 py-0.5 rounded-full bg-amber-500 text-[9px] text-white uppercase ml-2 sm:ml-0 inline-block align-middle animate-pulse">Agora</span>}
                                                </div>
                                                <div className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${ph.t === 'done' ? 'bg-emerald-500/10 text-emerald-400' : ph.t === 'in' ? 'bg-amber-500/10 text-amber-400' : ph.t === 'next' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-500/10 text-zinc-400'
                                                    }`}>
                                                    {ph.lb}
                                                </div>
                                            </div>

                                            {/* Timeline Visual (Desktop only) */}
                                            <div className="hidden sm:flex flex-col items-center flex-shrink-0 pt-4">
                                                <div className={`w-3 h-3 rounded-full flex-shrink-0 relative ${ph.t === 'done' ? 'bg-emerald-500' : ph.t === 'in' ? 'bg-amber-500 border-2 border-amber-300' : ph.t === 'next' ? 'bg-blue-500' : 'bg-zinc-600'}`}></div>
                                                {idx < PHASES.length - 1 && <div className="w-[2px] bg-zinc-800 flex-1 mt-2 mb-[-1rem] relative z-0"></div>}
                                            </div>

                                            {/* Chips Bubble */}
                                            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:mt-1">
                                                {items.length === 0 ? (
                                                    <div className="text-xs text-zinc-600 italic">Nenhum produto listado nesta fase.</div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {items.map(p => (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => setSelectedProdId(p.id)}
                                                                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-transform hover:scale-105 flex items-center gap-2 ${STAT_COLORS[p.s as keyof typeof STAT_COLORS]}`}
                                                            >
                                                                <div className={`w-1.5 h-1.5 rounded-full ${DIR_DOT_COLORS[p.d]}`}></div>
                                                                {p.n}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* PRODUTOS (Table) */}
                    {view === 'produtos' && (
                        <div className="flex flex-col">
                            <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
                                <span className="text-sm font-bold text-zinc-500 py-1.5 mr-2 uppercase">Filtrar:</span>
                                {['all', 'store', 'breve', 'backlog', 'DDS', 'DIT', 'DRM', 'PRE'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setProdFilter(f)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border ${prodFilter === f ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}
                                    >
                                        {['DDS', 'DIT', 'DRM', 'PRE'].includes(f) && <div className={`w-2 h-2 rounded-full ${DIR_DOT_COLORS[f]}`}></div>}
                                        {f === 'store' && '✅ Na Store'}
                                        {f === 'breve' && '🔜 Em breve'}
                                        {f === 'backlog' && '📋 Backlog'}
                                        {f === 'all' && 'Todos'}
                                        {['DDS', 'DIT', 'DRM', 'PRE'].includes(f) && f}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                            <th className="px-4 py-3 border-b border-zinc-800 w-12 text-center">#</th>
                                            <th className="px-4 py-3 border-b border-zinc-800">Produto</th>
                                            <th className="px-4 py-3 border-b border-zinc-800">Diretoria</th>
                                            <th className="px-4 py-3 border-b border-zinc-800">Status</th>
                                            <th className="px-4 py-3 border-b border-zinc-800">Fase</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/50">
                                        {filteredTableProds.map((p, i) => (
                                            <tr key={p.id} onClick={() => setSelectedProdId(p.id)} className="hover:bg-zinc-800/50 cursor-pointer transition-colors group">
                                                <td className="px-4 py-3 text-sm text-zinc-500 text-center">{i + 1}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-zinc-200 group-hover:text-indigo-400">{p.n}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md border ${DIR_COLORS[p.d]}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${DIR_DOT_COLORS[p.d]}`}></span>
                                                        {p.d}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${STAT_COLORS[p.s as keyof typeof STAT_COLORS]}`}>
                                                        {STAT_LABELS[p.s as keyof typeof STAT_LABELS]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-zinc-400">{p.f}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {activeProd && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedProdId(null)}>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedProdId(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">×</button>
                        
                        <h2 className="text-xl font-black text-white pr-8 mb-4">{activeProd.n}</h2>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md border ${DIR_COLORS[activeProd.d]}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${DIR_DOT_COLORS[activeProd.d]}`}></span>
                                {activeProd.d}
                            </span>
                            <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${STAT_COLORS[activeProd.s as keyof typeof STAT_COLORS]}`}>
                                {STAT_LABELS[activeProd.s as keyof typeof STAT_LABELS]}
                            </span>
                            {activeProd.mkt && (
                                <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                                    🏪 Marketplace
                                </span>
                            )}
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Categoria</div>
                                <div className="text-sm font-medium text-zinc-200">{activeProd.cat}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Diretoria</div>
                                <div className="text-sm font-medium text-zinc-200">{DIR_NAMES[activeProd.d]}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Fase de entrega</div>
                                <div className="text-sm font-medium text-zinc-200">{activeProd.f}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Disponível no Marketplace</div>
                                <div className="text-sm font-medium text-zinc-200">{activeProd.mkt ? 'Sim' : 'Não'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #3f3f46;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
