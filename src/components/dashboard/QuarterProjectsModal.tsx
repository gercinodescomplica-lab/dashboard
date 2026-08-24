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
    lightActive?: boolean;
}

function getTempEmoji(temp?: OpportunityTemperature) {
    if (temp === 'quente') return '🔥';
    if (temp === 'frio') return '❄️';
    if (temp === 'contratado') return '✅';
    if (temp === 'historico') return '⏸️';
    if (temp === 'perdido') return '❌';
    return '🟡';
}

export function QuarterProjectsModal({
    isOpen,
    onClose,
    quarterLabel,
    projects,
    totalValue,
    managerName,
    lightActive = false,
}: QuarterProjectsModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`max-w-xl max-h-[80vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl transition-colors duration-200 ${lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'}`}>
                <DialogHeader className={`p-6 pb-4 border-b transition-colors duration-200 ${lightActive ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800/60 bg-zinc-900/20'}`}>
                    <DialogTitle className="text-xl font-bold flex flex-col items-start mr-6 gap-1">
                        <span>Oportunidades {quarterLabel}</span>
                        <span className={`text-sm font-medium font-normal ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            Gerente: {managerName}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className={`flex-1 overflow-y-auto p-6 transition-colors duration-200 ${lightActive ? 'bg-zinc-50/50' : 'bg-zinc-950/50'}`}>
                    {projects.length > 0 ? (
                        <div className={`rounded-xl border overflow-hidden divide-y transition-colors duration-200 ${lightActive ? 'border-zinc-200 bg-white divide-zinc-200' : 'border-zinc-800/60 bg-zinc-900/50 divide-zinc-800/60'}`}>
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
                                    <div key={index} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 transition-colors ${lightActive ? 'hover:bg-zinc-50' : 'hover:bg-zinc-800/40'}`}>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="text-xs font-semibold text-brand-pipeline uppercase tracking-wider">{displayOrgao || 'Sem Órgão'}</div>
                                            <div className={`font-medium flex items-start gap-1.5 pt-0.5 ${lightActive ? 'text-zinc-700' : 'text-zinc-200'}`}>
                                                <span title={project.temperature || 'morno'} className="text-sm shrink-0 leading-5">{getTempEmoji(project.temperature)}</span>
                                                <span className="line-clamp-2 text-sm leading-5 break-words">{displayName}</span>
                                            </div>
                                        </div>
                                        <div className={`text-sm sm:text-base font-bold tracking-tight px-3 py-1.5 rounded-lg border min-w-max transition-colors duration-200 ${lightActive ? 'text-zinc-900 bg-zinc-50 border-zinc-200' : 'text-zinc-100 bg-zinc-950 border-zinc-800/50'}`}>{formatCurrency(project.value)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={`flex flex-col items-center justify-center py-12 border border-dashed rounded-xl transition-colors duration-200 ${lightActive ? 'text-zinc-400 border-zinc-200 bg-zinc-50' : 'text-zinc-500 border-zinc-800/60 bg-zinc-900/20'}`}>
                            <p className="text-base">Nenhuma oportunidade cadastrada neste trimestre.</p>
                        </div>
                    )}
                </div>

                {projects.length > 0 && (
                    <div className={`p-6 border-t flex items-center justify-between transition-colors duration-200 ${lightActive ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                        <span className={`text-sm font-medium uppercase tracking-wider ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>Total do trimestre</span>
                        <span className="text-lg font-bold text-brand-pipeline">{formatCurrency(totalValue)}</span>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
