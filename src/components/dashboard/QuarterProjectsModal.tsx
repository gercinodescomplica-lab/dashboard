import { Project, OpportunityTemperature } from '@/types/manager';
import { formatCurrency } from '@/lib/format';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface QuarterProjectsModalProps {
    isOpen: boolean;
    onClose: () => void;
    quarterLabel: string;
    projects: Project[];
    totalValue: number;
    managerName: string;
}

function getTempEmoji(temp?: OpportunityTemperature) {
    if (temp === 'quente') return '🔥';
    if (temp === 'frio') return '❄️';
    return '🟡';
}

export function QuarterProjectsModal({
    isOpen,
    onClose,
    quarterLabel,
    projects,
    totalValue,
    managerName,
}: QuarterProjectsModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-zinc-800/60 bg-zinc-900/20">
                    <DialogTitle className="text-xl font-bold flex flex-col items-start mr-6 gap-1">
                        <span>Oportunidades {quarterLabel}</span>
                        <span className="text-sm font-medium text-zinc-400 font-normal">
                            Gerente: {managerName}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/50">
                    {projects.length > 0 ? (
                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden divide-y divide-zinc-800/60">
                            {projects.map((project, index) => {
                                let displayOrgao = project.orgao;
                                let displayName = project.name;

                                // Robust fallback logic for mock data that combines orgao and name with any hyphen
                                if (!displayOrgao) {
                                    const match = displayName.match(/^(.+?)\s*[-–—]\s*(.+)$/);
                                    if (match) {
                                        displayOrgao = match[1].trim();
                                        displayName = match[2].trim();
                                    }
                                }

                                return (
                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-zinc-800/40 transition-colors">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="text-xs font-semibold text-brand-pipeline uppercase tracking-wider">{displayOrgao || 'Sem Órgão'}</div>
                                            <div className="font-medium text-zinc-200 flex items-start gap-1.5 pt-0.5">
                                                <span title={project.temperature || 'morno'} className="text-sm shrink-0 leading-5">{getTempEmoji(project.temperature)}</span>
                                                <span className="line-clamp-2 text-sm leading-5 break-words">{displayName}</span>
                                            </div>
                                        </div>
                                        <div className="text-sm sm:text-base text-zinc-100 font-bold tracking-tight bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800/50 min-w-max">{formatCurrency(project.value)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 border border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/20">
                            <p className="text-base">Nenhuma oportunidade cadastrada neste trimestre.</p>
                        </div>
                    )}
                </div>

                {projects.length > 0 && (
                    <div className="p-6 border-t border-zinc-800/60 bg-zinc-900/40 flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Total do trimestre</span>
                        <span className="text-lg font-bold text-brand-pipeline">{formatCurrency(totalValue)}</span>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
