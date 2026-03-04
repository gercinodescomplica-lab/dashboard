import { Manager } from '@/types/manager';
import { StatBadge } from './StatBadge';
import { calculateAchievementPercentage, determinePerformanceStatus } from '@/lib/calc';
import { UserCircle2 } from 'lucide-react';

interface ManagerHeaderProps {
    manager: Manager;
}

export function ManagerHeader({ manager }: ManagerHeaderProps) {
    const achievementPercentage = calculateAchievementPercentage(manager.forecastFinal, manager.meta);
    const status = determinePerformanceStatus(achievementPercentage);

    return (
        <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {manager.avatarUrl && manager.avatarUrl !== '' && !manager.avatarUrl.includes('placeholder') ? (
                        // In a real app we would use next/image here, but an img tag is fine for now
                        <img src={manager.avatarUrl} alt={manager.name} className="w-full h-full object-cover object-top" />
                    ) : (
                        <UserCircle2 className="w-16 h-16 text-zinc-500" />
                    )}
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-zinc-100">{manager.name}</h3>
                    <p className="text-base font-medium text-zinc-400">{manager.role}</p>
                </div>
            </div>
            <StatBadge status={status} />
        </div>
    );
}
