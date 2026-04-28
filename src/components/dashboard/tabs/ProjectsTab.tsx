'use client';

import { Project, PipelineData } from '@/types/manager';
import { formatCurrency } from '@/lib/format';

interface ProjectsTabProps {
    pipeline: PipelineData;
}

const QUARTER_LABELS: Record<string, string> = {
    q1: 'Q1 — 1º Trimestre',
    q2: 'Q2 — 2º Trimestre',
    q3: 'Q3 — 3º Trimestre',
    q4: 'Q4 — 4º Trimestre',
    nao_mapeado: 'Não Mapeado',
};

const TEMP_STYLES: Record<string, { emoji: string; color: string }> = {
    quente: { emoji: '🔥', color: 'text-orange-400' },
    morno: { emoji: '🟡', color: 'text-yellow-400' },
    frio: { emoji: '❄️', color: 'text-blue-400' },
    contratado: { emoji: '✅', color: 'text-emerald-400' },
    historico: { emoji: '⏸️', color: 'text-orange-300' },
    perdido: { emoji: '❌', color: 'text-red-500' },
};

export function ProjectsTab({ pipeline }: ProjectsTabProps) {
    // Flatten all projects with quarter info, sorted by quarter then by value desc
    const rows: Array<{ quarter: string; project: Project }> = [];
    (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).forEach((q) => {
        if (pipeline[q] && pipeline[q].projects) {
            pipeline[q].projects.forEach((p) => {
                rows.push({ quarter: q, project: p });
            });
        }
    });

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 text-zinc-500">
                Nenhum projeto cadastrado no pipeline.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-800 text-left">
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-32">Quarter</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Projeto</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Órgão / Cliente</th>
                        <th className="pb-3 pr-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Valor</th>
                        <th className="pb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-20">Temp.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {rows.map(({ quarter, project }, i) => {
                        const temp = project.temperature ? TEMP_STYLES[project.temperature] : null;
                        return (
                            <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                                <td className="py-3 pr-4">
                                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                                        {quarter === 'nao_mapeado' ? 'NÃO MAP' : quarter.toUpperCase()}
                                    </span>
                                </td>
                                <td className="py-3 pr-4">
                                    <div className="flex flex-col">
                                        <span className="text-zinc-200 font-medium">{project.name}</span>
                                        {project.description && (
                                            <span className="text-zinc-500 text-xs mt-0.5 line-clamp-1 truncate block max-w-[200px]" title={project.description}>
                                                {project.description}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 pr-4 text-zinc-400">{project.orgao || <span className="text-zinc-600">—</span>}</td>
                                <td className="py-3 pr-2 text-right font-mono font-semibold text-emerald-400">
                                    {formatCurrency(project.value)}
                                </td>
                                <td className="py-3 text-center text-base">
                                    {temp ? <span title={project.temperature}>{temp.emoji}</span> : <span className="text-zinc-700">—</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t border-zinc-700">
                        <td colSpan={3} className="pt-3 text-xs text-zinc-600 uppercase tracking-wider">Total</td>
                        <td className="pt-3 text-right font-mono font-bold text-zinc-100">
                            {formatCurrency(rows.reduce((acc, { project }) => acc + project.value, 0))}
                        </td>
                        <td />
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
