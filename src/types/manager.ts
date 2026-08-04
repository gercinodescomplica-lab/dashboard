export type OpportunityTemperature = 'quente' | 'morno' | 'frio' | 'contratado' | 'historico' | 'perdido';
export type CXStatus = 'pendente' | 'analise' | 'resolvido';
export type CXCriticidade = 'baixa' | 'media' | 'alta';

export type HistoryChangeType = 'status' | 'valor' | 'quarter' | 'nota';

export interface ProjectHistoryItem {
  id?: string;
  date: string;
  tipo: HistoryChangeType;
  de?: string;
  para?: string;
  justificativa?: string;
  autor?: string;
}

export interface Project {
  orgao?: string;
  name: string;
  value: number;
  temperature?: OpportunityTemperature;
  description?: string;
  durationMonths?: number;
  startDate?: string;
  billingStartMonth?: number;
  history?: ProjectHistoryItem[];
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
  isVisible?: boolean;
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
  meta: number; // Meta Total
  metaNovosNegocios?: number; // Meta específica para novos negócios (Negócios Concluídos)
  contratado: number; // Base herdada (Contratos Herdados)
  contratosHerdados?: number;
  novosNegocios?: number; // Total TCV dos novos contratos no pipeline
  contratado2026?: number; // Contratos Herdados + Parcela pro-rata de 2026 dos novos negócios
  forecastFinal: number;
  pipeline: PipelineData;
  notes?: string;
  cx?: CXItem[];
  visits?: Visit[];
  servedClients?: string[];
  showInDashboard?: boolean;
}
