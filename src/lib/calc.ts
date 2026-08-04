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
 * Sums the total TCV value of all pipeline projects marked as 'contratado' (Novos Negócios)
 */
export function sumNovosNegocios(pipeline: PipelineData): number {
    if (!pipeline) return 0;
    return Object.values(pipeline).reduce((acc, quarter: QuarterData) => {
        const contracted = (quarter?.projects || [])
            .filter(p => p.temperature === 'contratado')
            .reduce((s, p) => s + (p.value || 0), 0);
        return acc + contracted;
    }, 0);
}

/**
 * Calculates the pro-rata recognized revenue in 2026 for a single project based on billing start month, quarter, and duration.
 */
export function calculateProject2026Value(
    project: { value: number; durationMonths?: number; startDate?: string; billingStartMonth?: number },
    quarterKey: string = 'q1'
): number {
    if (!project || !project.value) return 0;
    const duration = project.durationMonths && project.durationMonths > 0 ? project.durationMonths : 12;
    const monthlyRate = project.value / duration;

    let monthsRemainingInYear: number;

    if (project.billingStartMonth && project.billingStartMonth >= 1 && project.billingStartMonth <= 12) {
        monthsRemainingInYear = Math.max(0, 12 - project.billingStartMonth + 1);
    } else if (project.startDate) {
        const monthMatch = project.startDate.match(/(\d{4})-(\d{2})/);
        if (monthMatch) {
            const year = parseInt(monthMatch[1], 10);
            const month = parseInt(monthMatch[2], 10);
            if (year === 2026 && month >= 1 && month <= 12) {
                monthsRemainingInYear = Math.max(0, 12 - month + 1);
            } else if (year < 2026) {
                monthsRemainingInYear = 12;
            } else {
                monthsRemainingInYear = 0;
            }
        } else {
            const monthsRemainingMap: Record<string, number> = {
                q1: 12,
                q2: 9,
                q3: 6,
                q4: 3,
                nao_mapeado: 6,
            };
            monthsRemainingInYear = monthsRemainingMap[quarterKey] ?? 12;
        }
    } else {
        const monthsRemainingMap: Record<string, number> = {
            q1: 12,
            q2: 9,
            q3: 6,
            q4: 3,
            nao_mapeado: 6,
        };
        monthsRemainingInYear = monthsRemainingMap[quarterKey] ?? 12;
    }

    const monthsIn2026 = Math.min(duration, monthsRemainingInYear);
    return monthlyRate * monthsIn2026;
}

/**
 * Sums the pro-rata 2026 recognized revenue of all pipeline projects marked as 'contratado'
 */
export function sumPipelineContratado2026(pipeline: PipelineData): number {
    if (!pipeline) return 0;
    return (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).reduce((acc, qKey) => {
        const quarter = pipeline[qKey];
        const contracted2026Sum = (quarter?.projects || [])
            .filter(p => p.temperature === 'contratado')
            .reduce((s, p) => s + calculateProject2026Value(p, qKey), 0);
        return acc + contracted2026Sum;
    }, 0);
}

/**
 * Legacy sum of pipeline contratado (full TCV)
 */
export function sumPipelineContratado(pipeline: PipelineData): number {
    return sumNovosNegocios(pipeline);
}

/**
 * Returns the effective contratado for 2026 = Contratos Herdados + sum of 2026 recognized revenue of 'contratado' projects
 */
export function calcEffectiveContratado(contratadoHerdado: number, pipeline: PipelineData): number {
    return (contratadoHerdado || 0) + sumPipelineContratado2026(pipeline);
}

/**
 * Calculates the Total Pipeline from all quarters, excluding 'historico' and 'perdido' projects
 */
export function calculatePipelineTotal(pipeline: Manager['pipeline']): number {
    if (!pipeline) return 0;
    return Object.values(pipeline).reduce((acc, curr) => {
        const active = (curr?.projects || []).filter((p: { temperature?: string }) => p.temperature !== 'historico' && p.temperature !== 'perdido');
        return acc + sumQuarterProjects(active);
    }, 0);
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
