import React from 'react';

export default function OrganizationChartView() {
    return (
        <div className="w-full h-full flex flex-col bg-zinc-950/40 rounded-2xl overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {/* Header */}
            <div className="flex flex-col items-center mb-8">
                <h2 className="text-xl font-bold tracking-[0.2em] text-zinc-100 mb-6">D R M</h2>
                
                {/* Director */}
                <div className="flex flex-col items-center">
                    <div className="bg-indigo-950/80 border border-indigo-800/50 rounded-xl px-10 py-3 text-center min-w-[200px] shadow-lg shadow-indigo-500/10">
                        <div className="text-[10px] font-medium tracking-[0.12em] text-indigo-300 uppercase mb-1">Diretor</div>
                        <div className="text-lg font-bold tracking-[0.08em] text-white">LUZ</div>
                    </div>
                </div>
                
                <div className="w-[1.5px] h-6 bg-zinc-800 my-0 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1.5px] bg-zinc-800 flex justify-between" style={{ width: '400px' }}></div>
                </div>

                {/* Sub-directors */}
                <div className="flex justify-center gap-24 relative w-full mb-10">
                    <div className="w-[1.5px] h-6 bg-zinc-800 absolute -top-6 left-1/2 -ml-[200px]"></div>
                    <div className="w-[1.5px] h-6 bg-zinc-800 absolute -top-6 left-1/2 ml-[200px]"></div>
                    
                    <div className="bg-indigo-900/60 border border-indigo-700/50 rounded-lg px-6 py-2 text-center min-w-[160px]">
                        <div className="text-[13px] font-bold text-white">DANI</div>
                        <div className="text-[11px] text-indigo-300 mt-0.5">Maria</div>
                    </div>

                    <div className="bg-indigo-900/60 border border-indigo-700/50 rounded-lg px-6 py-2 text-center min-w-[160px]">
                        <div className="text-[13px] font-bold text-white">ALBERTO</div>
                        <div className="text-[11px] text-indigo-300 mt-0.5">Elias</div>
                    </div>
                </div>
            </div>

            {/* Horizontal Line Connecting Departments */}
            <div className="w-full h-[1.5px] bg-zinc-800 mb-6"></div>

            {/* Departments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 flex-1">
                
                {/* KAM */}
                <div className="flex flex-col">
                    <div className="mx-auto w-[1.5px] h-3 bg-zinc-800 -mt-6"></div>
                    <div className="bg-indigo-600 p-2 text-center rounded-t-lg border border-indigo-500 shadow-sm">
                        <span className="block text-sm font-bold text-white leading-tight">KAM</span>
                        <span className="block text-[9px] text-indigo-100/90 mt-0.5">Key Account Manager</span>
                    </div>
                    <div className="border border-t-0 border-indigo-900/50 bg-zinc-900/30 rounded-b-lg p-2 flex-1 space-y-3 shadow-inner">
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">MALDE</div>
                            <div className="text-[10px] px-2 text-zinc-400">Viviane</div>
                            <div className="text-[10px] px-2 text-zinc-400">Julia (estag.)</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">BETONE</div>
                            <div className="text-[10px] px-2 text-zinc-400">Viviane</div>
                            <div className="text-[10px] px-2 text-zinc-400">Julia (estag.)</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">ANDREA</div>
                            <div className="text-[10px] px-2 text-zinc-400">Vera</div>
                            <div className="text-[10px] px-2 text-zinc-400">Thais (estag.)</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">TOMIATTO</div>
                            <div className="text-[10px] px-2 text-zinc-400">Vera</div>
                            <div className="text-[10px] px-2 text-zinc-400">Thais (estag.)</div>
                        </div>
                    </div>
                </div>

                {/* GRC */}
                <div className="flex flex-col">
                    <div className="mx-auto w-[1.5px] h-3 bg-zinc-800 -mt-6"></div>
                    <div className="bg-emerald-600 p-2 text-center rounded-t-lg border border-emerald-500 shadow-sm">
                        <span className="block text-sm font-bold text-white leading-tight">GRC</span>
                        <span className="block text-[9px] text-emerald-100/90 mt-0.5">Gerência Rel. Comercial</span>
                    </div>
                    <div className="border border-t-0 border-emerald-900/50 bg-zinc-900/30 rounded-b-lg p-2 flex-1 space-y-3 shadow-inner">
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">grc1 BRUNO</div>
                            <div className="text-[10px] px-2 text-zinc-400">Tadahiro</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">grc2 PAULO</div>
                            <div className="text-[10px] px-2 text-zinc-400">Marcilio</div>
                            <div className="text-[10px] px-2 text-zinc-400">Ingrid (estag.)</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">grc3 BARONE</div>
                            <div className="text-[10px] px-2 text-zinc-400">Andrea Farias</div>
                            <div className="text-[10px] px-2 text-zinc-400">Amanda (estag.)</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">grc4 BEATRIZ</div>
                            <div className="text-[10px] px-2 text-zinc-400">Simone</div>
                            <div className="text-[10px] px-2 text-zinc-400">Renato</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">grcc DEBORA</div>
                            <div className="flex items-center gap-1.5 px-2">
                                <span className="text-[10px] text-zinc-400">Marcella</span>
                                <span className="text-[8px] font-medium px-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 truncate whitespace-nowrap">Em contratação</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GCX */}
                <div className="flex flex-col">
                    <div className="mx-auto w-[1.5px] h-3 bg-zinc-800 -mt-6"></div>
                    <div className="bg-amber-600 p-2 text-center rounded-t-lg border border-amber-500 shadow-sm">
                        <span className="block text-sm font-bold text-white leading-tight">GCX</span>
                        <span className="block text-[9px] text-amber-100/90 mt-0.5">Gerência Customer Exp.</span>
                    </div>
                    <div className="border border-t-0 border-amber-900/50 bg-zinc-900/30 rounded-b-lg p-2 flex-1 space-y-3 shadow-inner">
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">LAMANA</div>
                            <div className="text-[10px] px-2 text-zinc-400">Denis</div>
                            <div className="text-[10px] px-2 text-zinc-400">Maria José</div>
                            <div className="text-[10px] px-2 text-zinc-400">Paulo</div>
                            <div className="text-[10px] px-2 text-zinc-400">Antônio</div>
                        </div>
                        <div className="border border-amber-900/40 rounded bg-zinc-950/50 overflow-hidden">
                            <div className="bg-amber-900/30 text-amber-500 p-1 flex flex-col px-2">
                                <span className="text-[10px] font-bold">NSO</span>
                                <span className="text-[8px] opacity-80">Núcleo Suporte Operacional</span>
                            </div>
                            <div className="p-1 px-2 pb-2">
                                <div className="text-[11px] font-bold py-0.5 text-zinc-200">OSCAR</div>
                                <div className="text-[10px] text-zinc-400">Wania</div>
                                <div className="flex items-center gap-1.5 py-0.5">
                                    <span className="text-[10px] text-zinc-400">Adriana Ferraz</span>
                                    <span className="text-[8px] font-medium px-1.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 truncate whitespace-nowrap">A confirmar</span>
                                </div>
                                <div className="text-[10px] text-zinc-400">Lindomar</div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">COBRANÇA</div>
                            <div className="text-[10px] px-2 text-zinc-400">Salatiel</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">JURÍDICO</div>
                            <div className="text-[10px] px-2 text-zinc-400">Elizanete</div>
                        </div>
                    </div>
                </div>

                {/* GIN */}
                <div className="flex flex-col">
                    <div className="mx-auto w-[1.5px] h-3 bg-zinc-800 -mt-6"></div>
                    <div className="bg-purple-700 p-2 text-center rounded-t-lg border border-purple-600 shadow-sm">
                        <span className="block text-sm font-bold text-white leading-tight">GIN</span>
                        <span className="block text-[9px] text-purple-100/90 mt-0.5">Gerência Inovação</span>
                    </div>
                    <div className="border border-t-0 border-purple-900/50 bg-zinc-900/30 rounded-b-lg p-2 flex-1 space-y-3 shadow-inner">
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">GERCINO</div>
                            <div className="flex items-center gap-1.5 px-2">
                                <span className="text-[10px] text-zinc-400">Lucas</span>
                                <span className="text-[8px] font-medium px-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 truncate whitespace-nowrap">Em contratação</span>
                            </div>
                            <div className="text-[10px] px-2 text-yellow-500/80">· A contratar</div>
                        </div>
                        <div className="border border-purple-900/40 rounded bg-zinc-950/50 overflow-hidden">
                            <div className="bg-purple-900/30 text-purple-400 p-1 flex flex-col px-2">
                                <span className="text-[10px] font-bold">NPE</span>
                                <span className="text-[8px] opacity-80">Núcleo Projetos Especiais</span>
                            </div>
                            <div className="p-1 px-2 pb-2">
                                <div className="text-[11px] font-bold py-0.5 text-zinc-200">VANESSA AVINO</div>
                                <div className="text-[10px] text-zinc-400">Roseane</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GDP */}
                <div className="flex flex-col">
                    <div className="mx-auto w-[1.5px] h-3 bg-zinc-800 -mt-6"></div>
                    <div className="bg-pink-700 p-2 text-center rounded-t-lg border border-pink-600 shadow-sm">
                        <span className="block text-sm font-bold text-white leading-tight">GDP</span>
                        <span className="block text-[9px] text-pink-100/90 mt-0.5">Gerência de Produtização</span>
                    </div>
                    <div className="border border-t-0 border-pink-900/50 bg-zinc-900/30 rounded-b-lg p-2 flex-1 space-y-3 shadow-inner">
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">PIMENTEL</div>
                            <div className="text-[10px] px-2 text-zinc-400">Rhayanne</div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5">
                                <span className="text-[10px] text-zinc-400">Wanessa</span>
                                <span className="text-[8px] font-medium px-1.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 truncate whitespace-nowrap">A confirmar</span>
                            </div>
                            <div className="text-[10px] px-2 text-zinc-400">Flavio</div>
                        </div>
                        <div className="border border-pink-900/40 rounded bg-zinc-950/50 overflow-hidden">
                            <div className="bg-pink-900/20 text-pink-400 p-1 flex flex-col px-2">
                                <span className="text-[10px] font-bold">NPS</span>
                                <span className="text-[8px] opacity-80">Núcleo Produtos e Software</span>
                            </div>
                            <div className="p-1 px-2 pb-2">
                                <div className="text-[11px] font-bold py-0.5 text-zinc-200">CLAUDIA</div>
                                <div className="text-[10px] text-zinc-400">Adriana Cristina</div>
                                <div className="text-[10px] text-zinc-400">Marcos Cesar</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* NIM */}
                <div className="flex flex-col">
                    <div className="mx-auto w-[1.5px] h-3 bg-zinc-800 -mt-6"></div>
                    <div className="bg-yellow-700 p-2 text-center rounded-t-lg border border-yellow-600 shadow-sm">
                        <span className="block text-sm font-bold text-white leading-tight">NIM</span>
                        <span className="block text-[9px] text-yellow-100/90 mt-0.5">Núcleo Intel. de Mercado</span>
                    </div>
                    <div className="border border-t-0 border-yellow-900/50 bg-zinc-900/30 rounded-b-lg p-2 flex-1 space-y-3 shadow-inner">
                        <div>
                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 mb-1">LINEU</div>
                            <div className="text-[10px] px-2 text-zinc-400">Daverson</div>
                            <div className="text-[10px] px-2 text-zinc-400">Delmiro</div>
                            <div className="text-[10px] px-2 text-zinc-400">Gilvan</div>
                            <div className="text-[10px] px-2 text-zinc-400">Marcelo</div>
                            <div className="text-[10px] px-2 text-zinc-400">Mauro</div>
                            <div className="text-[10px] px-2 text-zinc-400">Kauan (estag.)</div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-8 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 items-center justify-between">
                <div className="flex gap-4 items-center">
                    <span className="text-[10px] font-medium text-zinc-500">Legenda:</span>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        Em contratação
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span>
                        A contratar
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                        A confirmar
                    </div>
                </div>
                <span className="text-[10px] text-zinc-500">Versão 5.0</span>
            </div>
        </div>
    );
}
