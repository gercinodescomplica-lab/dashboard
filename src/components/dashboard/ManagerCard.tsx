import { Manager } from '@/types/manager';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ManagerHeader } from './ManagerHeader';
import { PerformanceBars } from './PerformanceBars';
import { PipelineBars } from './PipelineBars';
import { ForecastKpis } from './ForecastKpis';

interface ManagerCardProps {
    manager: Manager;
}

export function ManagerCard({ manager }: ManagerCardProps) {
    return (
        <Card className="bg-zinc-950/50 border-zinc-800/60 overflow-hidden shadow-xl backdrop-blur-sm">
            <CardHeader className="pb-4 border-b border-zinc-900/50 bg-zinc-900/20">
                <ManagerHeader manager={manager} />
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                <ForecastKpis forecastFinal={manager.forecastFinal} meta={manager.meta} />

                <div className="space-y-6">
                    <div className="pt-2 border-t border-zinc-900/50">
                        <h4 className="text-sm font-medium text-zinc-400 mb-4">Performance</h4>
                        <PerformanceBars meta={manager.meta} contratado={manager.contratado} />
                    </div>

                    <div className="pt-6 border-t border-zinc-900/50">
                        <PipelineBars pipeline={manager.pipeline} />
                    </div>
                </div>

                {manager.notes && (
                    <div className="pt-4 border-t border-zinc-900/50">
                        <p className="text-xs text-zinc-500 italic">
                            <span className="font-semibold text-zinc-400 block mb-1">Notas:</span>
                            {manager.notes}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
