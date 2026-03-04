import { Manager } from '@/types/manager';
import { ManagerHeader } from './ManagerHeader';
import { PerformanceBars } from './PerformanceBars';
import { PipelineBars } from './PipelineBars';
import { ForecastKpis } from './ForecastKpis';

interface SingleManagerViewProps {
    manager: Manager;
}

export function SingleManagerView({ manager }: SingleManagerViewProps) {
    return (
        <div className="flex-1 flex flex-col gap-6 min-h-0 h-full pb-6">

            {/* Top half: Header, KPIs, Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-1/2 min-h-[300px]">

                {/* Left Column: Info & KPIs */}
                <div className="lg:col-span-5 flex flex-col gap-6 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
                    <ManagerHeader manager={manager} />

                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-full">
                            <ForecastKpis forecastFinal={manager.forecastFinal} meta={manager.meta} />
                        </div>
                    </div>
                </div>

                {/* Right Column: Performance Bars */}
                <div className="lg:col-span-7 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-center backdrop-blur-md">
                    <h4 className="text-lg font-medium text-zinc-400 mb-6">Desempenho da Meta</h4>
                    <PerformanceBars meta={manager.meta} contratado={manager.contratado} />
                </div>

            </div>

            {/* Bottom half: Pipeline */}
            <div className="flex-1 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md flex flex-col min-h-0">
                <PipelineBars pipeline={manager.pipeline} />
            </div>

        </div>
    );
}
