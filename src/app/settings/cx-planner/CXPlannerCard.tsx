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

// Iniciais do responsável p/ o "avatar" redondo estilo Planner.
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

export function CXPlannerCard({ item, onClick, lightActive = false }: CXPlannerCardProps) {
    const style = prioridadeStyle(item.prioridadeTexto);
    const overdue = isOverdue(item.dataFim, item.status);
    const percent = Math.max(0, Math.min(100, item.percentComplete ?? 0));
    const fimBR = formatDateOnlyBR(item.dataFim);

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
        subtitle: lightActive ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-zinc-300',
        barBg: lightActive ? 'bg-zinc-200' : 'bg-zinc-800',
        percentText: lightActive ? 'text-zinc-500' : 'text-zinc-600',
        prazoChip: overdue
            ? (lightActive ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400')
            : (lightActive ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-800 text-zinc-200'),
        editedText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        avatar: lightActive ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300',
        responsavelText: lightActive ? 'text-zinc-600' : 'text-zinc-300',
    };

    return (
        // <div role="button"> em vez de <button>: um <button> nativo engole o
        // gesto de arrastar em alguns navegadores, quebrando o drag-and-drop
        // do card entre buckets. Com div, o `draggable` do wrapper (no board)
        // funciona e o clique continua abrindo o modal.
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={`w-full text-left border border-l-4 ${style.border} rounded-lg p-2 flex flex-col gap-1 transition-colors duration-200 cursor-pointer ${T.card}`}
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

            {item.subtitulo && (
                <span className={`self-start px-1.5 py-px rounded text-[10px] font-medium ${T.subtitle}`}>
                    {item.subtitulo}
                </span>
            )}

            <div className="flex items-center gap-2">
                <div className={`flex-1 h-1 rounded-full overflow-hidden min-w-6 ${T.barBg}`}>
                    <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                </div>
                <span className={`text-[9px] shrink-0 tabular-nums ${T.percentText}`}>{percent}%</span>
            </div>

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {fimBR && (
                        <span
                            title={overdue ? `Prazo vencido em ${fimBR}` : `Prazo: ${fimBR}`}
                            className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${T.prazoChip}`}
                        >
                            <CalendarClock className="w-3.5 h-3.5" /> {fimBR}
                        </span>
                    )}
                    {item.responsavelName && (
                        <span className={`flex items-center gap-1 min-w-0 ${T.responsavelText}`} title={`Responsável: ${item.responsavelName}`}>
                            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold shrink-0 ${T.avatar}`}>
                                {initials(item.responsavelName)}
                            </span>
                            <span className="text-[10.5px] truncate">{firstName(item.responsavelName)}</span>
                        </span>
                    )}
                </div>
                {lastEditedDisplay && (
                    <span title={`Última atualização: ${lastEditedDisplay}`} className={`flex items-center gap-1 shrink-0 text-[10.5px] font-mono ${T.editedText}`}>
                        <History className="w-3 h-3" /> {lastEditedDisplay}
                    </span>
                )}
            </div>
        </div>
    );
}
