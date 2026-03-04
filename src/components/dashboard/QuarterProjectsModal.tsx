import { Project } from '@/types/manager';
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
}

export function QuarterProjectsModal({
    isOpen,
    onClose,
    quarterLabel,
    projects,
    totalValue,
}: QuarterProjectsModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center justify-between mr-6">
                        <span>Oportunidades {quarterLabel}</span>
                        <span className="text-indigo-400">{formatCurrency(totalValue)}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 mt-4">
                    {projects.length > 0 ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden divide-y divide-zinc-800/50">
                            {projects.map((project, index) => (
                                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-zinc-800/50 transition-colors">
                                    <div className="font-medium text-zinc-200">{project.name}</div>
                                    <div className="text-sm text-zinc-400 font-mono">{formatCurrency(project.value)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            Nenhum projeto registrado neste trimestre.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
