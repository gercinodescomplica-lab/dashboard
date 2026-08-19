import { Manager } from '@/types/manager';
import { StatBadge } from './StatBadge';
import { calculateAchievementPercentage, determinePerformanceStatus, sumPipelineContratado2026 } from '@/lib/calc';
import { UserCircle2 } from 'lucide-react';

interface ManagerHeaderProps {
    manager: Manager;
    lightActive?: boolean;
}

export function ManagerHeader({ manager, lightActive = false }: ManagerHeaderProps) {
    const novosNegocios = manager.novosNegocios ?? sumPipelineContratado2026(manager.pipeline);
    const achievementPercentage = calculateAchievementPercentage(novosNegocios, manager.meta);
    const status = determinePerformanceStatus(achievementPercentage);

    return (
        <div className="flex flex-col min-[450px]:flex-row min-[450px]:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
                <div className={`w-16 h-16 sm:w-24 sm:h-24 rounded-full border-2 flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors duration-200 ${lightActive ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                    {manager.avatarUrl && manager.avatarUrl !== '' && !manager.avatarUrl.includes('placeholder') ? (
                        // In a real app we would use next/image here, but an img tag is fine for now
                        <img src={manager.avatarUrl} alt={manager.name} className="w-full h-full object-cover object-top" />
                    ) : (
                        <UserCircle2 className={`w-10 h-10 sm:w-16 sm:h-16 ${lightActive ? 'text-zinc-400' : 'text-zinc-500'}`} />
                    )}
                </div>
                <div>
                    <h3 className={`text-xl sm:text-2xl font-bold ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>{manager.name}</h3>
                    <p className={`text-base font-medium ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>{manager.role}</p>
                </div>
            </div>
            <StatBadge status={status} />
        </div>
    );
}
