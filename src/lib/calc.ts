import { Manager, PipelineData, QuarterData } from '../types/manager';

export type PerformanceStatus = 'Acima da meta' | 'Muito perto' | 'Atenção' | 'Crítico';

/**
 * Calculates the Gap (Target - Contracted)
 */
export function calculateGap(meta: number, contratado: number): number {
    return meta - contratado;
}

/**
 * Sums the total value of an array of projects
 */
export function sumQuarterProjects(projects: { value: number }[]): number {
    return projects.reduce((acc, curr) => acc + (curr.value || 0), 0);
}

/**
 * Sums the value of all pipeline projects marked as 'contratado'
 */
export function sumPipelineContratado(pipeline: PipelineData): number {
    return Object.values(pipeline).reduce((acc, quarter: QuarterData) => {
        const contracted = (quarter.projects || [])
            .filter(p => p.temperature === 'contratado')
            .reduce((s, p) => s + (p.value || 0), 0);
        return acc + contracted;
    }, 0);
}

/**
 * Returns the effective contratado = manager.contratado + sum of pipeline projects tagged as 'contratado'
 */
export function calcEffectiveContratado(contratado: number, pipeline: PipelineData): number {
    return (contratado || 0) + sumPipelineContratado(pipeline);
}

/**
 * Calculates the Total Pipeline from all quarters
 */
export function calculatePipelineTotal(pipeline: Manager['pipeline']): number {
    return Object.values(pipeline).reduce((acc, curr) => acc + sumQuarterProjects(curr.projects), 0);
}

/**
 * Calculates the Forecast Final (Contracted + Total Pipeline)
 */
export function calculateForecastFinal(contratado: number, pipeline: Manager['pipeline']): number {
    return (contratado || 0) + calculatePipelineTotal(pipeline);
}

/**
 * Calculates the Achievement Percentage (Forecast / Target * 100)
 */
export function calculateAchievementPercentage(forecastFinal: number, meta: number): number {
    if (meta === 0) return 0;
    return (forecastFinal / meta) * 100;
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
