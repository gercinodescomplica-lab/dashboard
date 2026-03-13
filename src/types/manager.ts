export type OpportunityTemperature = 'quente' | 'morno' | 'frio';
export type CXStatus = 'pendente' | 'analise' | 'resolvido';
export type CXCriticidade = 'baixa' | 'media' | 'alta';

export interface Project {
  orgao?: string;
  name: string;
  value: number;
  temperature?: OpportunityTemperature;
  description?: string;
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
  nao_mapeado: QuarterData;
}

export interface CXItem {
  id?: number;
  cliente: string;
  titulo: string;
  problema: string;
  solucaoProposta: string;
  status: CXStatus;
  criticidade?: CXCriticidade;
  createdAt?: string;
}

export interface Visit {
  id?: number;
  titulo: string;
  local: string;
  motivo: string;
  data: string; // "YYYY-MM-DD"
  dataFim?: string; // "YYYY-MM-DD"
  createdAt?: string;
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
  cx?: CXItem[];
  visits?: Visit[];
}
