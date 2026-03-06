import { Manager } from '@/types/manager';
import { formatCurrency } from '@/lib/format';
import { calculateGap } from '@/lib/calc';
import { Building2 } from 'lucide-react';

interface DRMOverviewProps {
    managers: Manager[];
    year: string;
}

export function DRMOverview({ managers, year }: DRMOverviewProps) {
    if (!managers || managers.length === 0) return null;

    // Calculate totals
    const totalMeta = managers.reduce((acc, m) => acc + m.meta, 0);
    const totalContratado = managers.reduce((acc, m) => acc + m.contratado, 0);

    // Sort managers by gap descending for the pyramid logic
    // The image has the largest ones at the bottom or middle, sorting by gap helps visually
    const managersWithGaps = managers.map(m => ({
        ...m,
        gap: calculateGap(m.meta, m.contratado)
    })).filter(m => m.gap > 0).sort((a, b) => b.gap - a.gap);

    // Determine the max possible width (Total Meta) to scale the blocks
    // In a stacked bar, the sum of Contracted + All Gaps = Total Meta
    // Let's use percentages based on Total Meta

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md text-center sm:text-left">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-2xl sm:text-3xl font-bold text-zinc-100">DRM - Visão Geral</h3>
                    <p className="text-sm sm:text-lg font-medium text-zinc-400">Diretoria de Relacionamento e Mercado ({year})</p>
                </div>

                <div className="mt-4 sm:mt-0 sm:ml-auto w-full sm:w-auto text-center sm:text-right border-t border-zinc-800 sm:border-0 pt-4 sm:pt-0">
                    <p className="text-xs sm:text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">Meta Global</p>
                    <p className="text-xl sm:text-3xl font-bold text-emerald-400 break-all sm:break-normal">{formatCurrency(totalMeta)}</p>
                </div>
            </div>

            <div className="flex-1 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center overflow-hidden min-h-[500px] backdrop-blur-md relative">

                {/* Always visible flow-based title instead of absolute top */}
                <div className="w-full flex justify-start sm:absolute sm:top-8 sm:left-8 mb-4 sm:mb-0">
                    <h4 className="text-lg sm:text-xl font-bold text-zinc-300 tracking-wide z-10 w-full text-center sm:text-left">COMPOSIÇÃO DE META</h4>
                </div>

                {/* Pyramid Container */}
                <div className="w-full max-w-5xl flex flex-col items-center justify-end h-full sm:pt-16 gap-1 relative z-0">

                    {/* A Contratar (Gaps) Blocks - Stacked on top */}
                    {managersWithGaps.reverse().map((m, index) => {
                        const totalBlocks = managersWithGaps.length;
                        const minWidth = 40;
                        const maxWidth = 90;
                        const step = totalBlocks > 1 ? (maxWidth - minWidth) / (totalBlocks - 1) : 0;
                        const widthPercent = minWidth + (index * step);

                        return (
                            <div key={m.id} className="flex items-center justify-center w-full" style={{ height: `calc((100% - 80px) / ${totalBlocks})`, maxHeight: '60px', minHeight: '30px' }}>
                                {/* Left Spacer */}
                                <div className="flex-1 hidden md:block min-w-0" />

                                {/* Center Block Container */}
                                <div className="w-full max-w-[500px] flex justify-center h-full shrink-0">
                                    <div
                                        className="bg-blue-600/90 border border-blue-500/50 hover:bg-blue-600 transition-colors h-full flex items-center justify-center shadow-lg shadow-black/20"
                                        style={{ width: `${widthPercent}%` }}
                                    >
                                        <div className="flex items-center justify-center gap-2 px-4 overflow-hidden w-full">
                                            <span className="text-xs sm:text-sm font-bold text-white/90 drop-shadow-md whitespace-nowrap">
                                                {formatCurrency(m.gap)}
                                            </span>
                                            <span className="text-xs sm:text-sm font-medium text-blue-200 truncate hidden sm:inline-block">
                                                {m.role === 'Projetos' ? m.name : `${m.role} - ${m.name}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Spacer (to keep block centered) */}
                                <div className="flex-1 hidden md:block" />
                            </div>
                        );
                    })}

                    {/* Contratado Base Block - Bottom */}
                    <div className="flex items-center justify-center w-full h-20 shrink-0 mt-2">
                        {/* Left Spacer & Label */}
                        <div className="flex-1 flex justify-end items-center pr-4 md:pr-8 min-w-0">
                            <span className="text-sm font-bold text-zinc-100 text-right">CONTRATADO</span>
                        </div>

                        {/* Center Block Container */}
                        <div className="w-full max-w-[500px] h-full flex justify-center shrink-0">
                            <div className="w-full bg-emerald-500/90 border border-emerald-400/50 h-full flex items-center justify-center shadow-lg shadow-black/20 rounded-b-md">
                                <span className="text-lg sm:text-xl font-bold text-black/80 drop-shadow-sm">
                                    {formatCurrency(totalContratado)}
                                </span>
                            </div>
                        </div>

                        {/* Right Spacer (to keep block centered) */}
                        <div className="flex-1 hidden md:block" />
                    </div>
                </div>

                {/* Legends */}
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col sm:flex-row gap-2 sm:gap-6 bg-zinc-950/50 px-4 py-2 rounded-lg border border-zinc-800/50 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm bg-emerald-500/90 border border-emerald-400/50"></div>
                        <span className="text-xs font-semibold text-zinc-300">CONTRATADO</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm bg-blue-600/80 border border-blue-500/50"></div>
                        <span className="text-xs font-semibold text-zinc-300">A CONTRATAR</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
