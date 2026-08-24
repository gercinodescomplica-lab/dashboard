'use client';

import { EyeOff } from 'lucide-react';
import { CXBoardItem } from '@/db/queries';
import { prioridadeStyle } from './board-config';

interface CXPlannerCardProps {
    item: CXBoardItem;
    onClick: () => void;
}

// Defense-in-depth: dataFim is expected to be a bare "YYYY-MM-DD" (normalized
// at the write point in src/lib/planner-sync.ts), but stay robust against a
// full ISO-datetime string too — either an already-imported row from before
// that fix, or any future producer of this field — by always taking just the
// first 10 chars before using it as a date.
function toDateOnly(v: string | null | undefined): string {
    return (v ?? '').slice(0, 10);
}

function isOverdue(dataFim: string | null | undefined, status: string): boolean {
    const dateOnly = toDateOnly(dataFim);
    if (!dateOnly || status === 'resolvido') return false;
    const deadline = new Date(dateOnly + 'T00:00:00');
    if (Number.isNaN(deadline.getTime())) return false;
    return deadline < new Date(new Date().toDateString());
}

export function CXPlannerCard({ item, onClick }: CXPlannerCardProps) {
    const style = prioridadeStyle(item.prioridadeTexto);
    const overdue = isOverdue(item.dataFim, item.status);
    const percent = Math.max(0, Math.min(100, item.percentComplete ?? 0));

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left bg-zinc-900 border border-zinc-800 border-l-4 ${style.border} rounded-lg p-3 flex flex-col gap-2 hover:border-zinc-700 transition-colors`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-400 truncate">{item.managerName} · {item.cliente}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                    {item.isVisible === false && (
                        <span
                            title="Oculto do painel do gerente"
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-zinc-800/60 text-zinc-500 border-zinc-700"
                        >
                            <EyeOff className="w-3 h-3" /> Oculto
                        </span>
                    )}
                    {item.prioridadeTexto && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style.badge}`}>
                            {item.prioridadeTexto}
                        </span>
                    )}
                </div>
            </div>
            <p className="text-sm font-medium text-zinc-200 line-clamp-2">{item.titulo || item.problema}</p>
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">{percent}%</span>
            </div>
            {item.dataFim && (
                <span className={`text-[10px] font-mono ${overdue ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                    Prazo: {toDateOnly(item.dataFim)}{overdue ? ' · ATRASADO' : ''}
                </span>
            )}
        </button>
    );
}
