import { Manager } from '@/types/manager';
import { ManagerCard } from './ManagerCard';
import { Skeleton } from '@/components/ui/skeleton';

interface ManagerGridProps {
    managers: Manager[];
    isLoading: boolean;
    error: string | null;
}

export function ManagerGrid({ managers, isLoading, error }: ManagerGridProps) {
    if (error) {
        return (
            <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <p className="font-medium">Erro ao carregar dados:</p>
                <p className="text-sm mt-1">{error}</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[500px] rounded-xl bg-zinc-900/50" />
                ))}
            </div>
        );
    }

    if (managers.length === 0) {
        return (
            <div className="p-12 text-center bg-zinc-900/20 border border-zinc-800/50 rounded-xl text-zinc-500">
                <p className="text-lg font-medium text-zinc-400">Nenhum gerente encontrado</p>
                <p className="text-sm mt-2">Ajuste os filtros de busca para ver resultados.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-12">
            {managers.map((manager) => (
                <ManagerCard key={manager.id} manager={manager} />
            ))}
        </div>
    );
}
