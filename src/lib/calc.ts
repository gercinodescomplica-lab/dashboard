import { Manager } from '../types/manager';

export type PerformanceStatus = 'Acima da meta' | 'Muito perto' | 'Atenção' | 'Crítico';

/**
 * Calculates the Gap (Target - Contracted)
 */
export function calculateGap(meta: number, contratado: number): number {
    return meta - contratado;
}

/**
 * Calculates the Achievement Percentage (Forecast / Target * 100)
 */
export function calculateAchievementPercentage(forecastFinal: number, meta: number): number {
    if (meta === 0) return 0;
    return (forecastFinal / meta) * 100;
}

/**
 * Calculates the Total Pipeline from all quarters
 */
export function calculatePipelineTotal(pipeline: Manager['pipeline']): number {
    return Object.values(pipeline).reduce((acc, curr) => acc + curr, 0);
}

/**
 * Determines the Performance Status based on the Achievement Percentage
 */
export function determinePerformanceStatus(achievementPercentage: number): PerformanceStatus {
    if (achievementPercentage >= 100) return 'Acima da meta';
    if (achievementPercentage >= 90) return 'Muito perto';
    if (achievementPercentage >= 70) return 'Atenção';
    return 'Crítico';
}

/**
 * Returns a color specific to the performance status to be used in UI components
 */
export function getStatusColor(status: PerformanceStatus): string {
    switch (status) {
        case 'Acima da meta':
            return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        case 'Muito perto':
            return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        case 'Atenção':
            return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
        case 'Crítico':
            return 'bg-red-500/10 text-red-500 border-red-500/20';
        default:
            return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
}
