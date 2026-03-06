export type OpportunityTemperature = 'quente' | 'morno' | 'frio';

export interface Project {
  orgao?: string;
  name: string;
  value: number;
  temperature?: OpportunityTemperature;
}

export interface QuarterData {
  total: number;
  projects: Project[];
}

export interface PipelineData {
  q1: QuarterData;
  q2: QuarterData;
  q3: QuarterData;
  q4: QuarterData;
}

export interface Manager {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  year: number;
  meta: number;
  contratado: number;
  forecastFinal: number;
  pipeline: PipelineData;
  notes?: string;
}
