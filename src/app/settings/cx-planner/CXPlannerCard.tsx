'use client';

import { EyeOff, History, CalendarClock } from 'lucide-react';
import { CXBoardItem } from '@/db/queries';
import { prioridadeStyle } from './board-config';
import { parseCXLogEntries, formatDateOnlyBR } from '@/lib/cx-log';

interface CXPlannerCardProps {
    item: CXBoardItem;
    onClick: () => void;
    lightActive?: boolean;
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

export function CXPlannerCard({ item, onClick, lightActive = false }: CXPlannerCardProps) {
    const style = prioridadeStyle(item.prioridadeTexto);
    const overdue = isOverdue(item.dataFim, item.status);
    const percent = Math.max(0, Math.min(100, item.percentComplete ?? 0));
    const fimBR = formatDateOnlyBR(item.dataFim);
    // Data da última edição: a entrada mais recente do log em `problema` (o
    // sync do Planner sempre prepende a atualização mais nova no topo — ver
    // syncPlannerTasks em planner-sync.ts — então a primeira entrada com
    // data é a mais recente). Itens criados direto no board (sem entradas
    // datadas no texto) caem no fallback de `createdAt`.
    const logEntries = parseCXLogEntries(item.problema);
    const firstDatedEntry = logEntries.find((e) => e.date);
    const lastEditedDisplay = firstDatedEntry
        ? firstDatedEntry.date!.split(/\s+/)[0]
        : formatDateOnlyBR(item.createdAt);

    const T = {
        card: lightActive ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
        header: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        eyeOff: lightActive ? 'text-zinc-400' : 'text-zinc-600',
        title: lightActive ? 'text-zinc-800' : 'text-zinc-200',
        barBg: lightActive ? 'bg-zinc-200' : 'bg-zinc-800',
        percentText: lightActive ? 'text-zinc-500' : 'text-zinc-600',
        prazoChip: overdue
            ? (lightActive ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400')
            : (lightActive ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-800 text-zinc-200'),
        editedText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left border border-l-4 ${style.border} rounded-lg p-2 flex flex-col gap-1 transition-colors duration-200 ${T.card}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={`text-[10.5px] font-semibold truncate ${T.header}`}>{item.managerName} · {item.cliente}</span>
                <div className="flex items-center gap-1 shrink-0">
                    {item.isVisible === false && (
                        <span title="Oculto do painel do gerente" className={T.eyeOff}>
                            <EyeOff className="w-3 h-3" />
                        </span>
                    )}
                    {item.prioridadeTexto && (
                        <span className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wider border ${lightActive ? style.badgeLight : style.badge}`}>
                            {item.prioridadeTexto}
                        </span>
                    )}
                </div>
            </div>
            <p className={`text-[13px] font-medium line-clamp-1 leading-snug ${T.title}`}>{item.titulo || item.problema}</p>
            <div className="flex items-center gap-2">
                <div className={`flex-1 h-1 rounded-full overflow-hidden min-w-6 ${T.barBg}`}>
                    <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                </div>
                <span className={`text-[9px] shrink-0 tabular-nums ${T.percentText}`}>{percent}%</span>
            </div>
            {(fimBR || lastEditedDisplay) && (
                <div className="flex items-center justify-between gap-2">
                    {fimBR ? (
                        <span
                            title={overdue ? `Prazo vencido em ${fimBR}` : `Prazo: ${fimBR}`}
                            className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${overdue ? 'font-bold' : ''} ${T.prazoChip}`}
                        >
                            <CalendarClock className="w-3.5 h-3.5" /> {fimBR}
                        </span>
                    ) : <span />}
                    {lastEditedDisplay && (
                        <span title={`Última atualização: ${lastEditedDisplay}`} className={`flex items-center gap-1 shrink-0 text-[10.5px] font-mono ${T.editedText}`}>
                            <History className="w-3 h-3" /> {lastEditedDisplay}
                        </span>
                    )}
                </div>
            )}
        </button>
    );
}
