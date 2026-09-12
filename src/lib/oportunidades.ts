/**
 * Rótulos, cores e ordenação das oportunidades em risco.
 *
 * Compartilhado entre a tela do gerente (`OportunidadesRiscoPainel`) e o dashboard
 * principal (`DRMOverview`) para os dois lados falarem a mesma língua: mesmo texto,
 * mesma cor, mesma ordem de criticidade.
 */

import type { Oportunidade, OportunidadeStatus } from '@/types/oportunidades';

/** Rótulo, cor (dark/light), cor de gráfico e ordem de exibição (menor = mais crítico) de cada status. */
export const STATUS_META: Record<string, { label: string; dark: string; light: string; grafico: string; ordem: number }> = {
    em_risco: {
        label: 'Em risco',
        dark: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        light: 'bg-amber-50 text-amber-700 border-amber-200',
        grafico: '#f59e0b',
        ordem: 1,
    },
    pendente: {
        label: 'Pendente',
        dark: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
        light: 'bg-zinc-100 text-zinc-700 border-zinc-300',
        grafico: '#a1a1aa',
        ordem: 2,
    },
    em_negociacao: {
        label: 'Em negociação',
        dark: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
        light: 'bg-sky-50 text-sky-700 border-sky-200',
        grafico: '#38bdf8',
        ordem: 3,
    },
    em_customizacao: {
        label: 'Em customização',
        dark: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
        light: 'bg-violet-50 text-violet-700 border-violet-200',
        grafico: '#a78bfa',
        ordem: 4,
    },
    nao_avancou: {
        label: 'Não avançou',
        dark: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
        light: 'bg-orange-50 text-orange-700 border-orange-200',
        grafico: '#fb923c',
        ordem: 5,
    },
    perdida: {
        label: 'Perdida',
        dark: 'bg-red-500/10 text-red-300 border-red-500/30',
        light: 'bg-red-50 text-red-700 border-red-200',
        grafico: '#f87171',
        ordem: 6,
    },
};

const STATUS_FALLBACK_META = {
    label: 'Sem status',
    dark: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
    light: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    grafico: '#71717a',
    ordem: 99,
};

/** Status que representam risco ou perda efetiva (usado nos KPIs de "risco/perdemos"). */
export const STATUS_RISCO_PERDA: OportunidadeStatus[] = ['em_risco', 'perdida'];

/** Tradução das causas raiz. Valor desconhecido cai no fallback legível (`humanizar`). */
export const CAUSA_LABEL: Record<string, string> = {
    demora_interna: 'Demora interna',
    descasamento_produto: 'Descasamento de produto',
    descasamento_escopo: 'Descasamento de escopo',
    concorrencia_licitacao: 'Concorrência / licitação própria',
    precificacao: 'Precificação',
    estruturacao_tecnica: 'Estruturação técnica',
    tempo_resposta: 'Tempo de resposta',
    falta_estrutura_produto: 'Falta de estrutura de produto',
    falta_produto: 'Falta de produto',
    falta_produto_interno: 'Falta de produto interno',
    nao_informada: 'Causa não informada',
};

export function humanizar(valor: string): string {
    const texto = valor.replace(/_/g, ' ').trim();
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function statusMeta(status: string) {
    return STATUS_META[status] ?? { ...STATUS_FALLBACK_META, label: humanizar(status || 'sem status') };
}

/** Cor hex do status para os gráficos (Recharts). */
export function statusColor(status: string): string {
    return statusMeta(status).grafico;
}

export function causaLabel(causa: string): string {
    return CAUSA_LABEL[causa] ?? humanizar(causa);
}

/** "2026-09-10" → "10/09/2026" (sem passar por Date, para não sofrer com fuso). */
export function formatarData(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const [ano, mes, dia] = iso.split('-');
    if (!ano || !mes || !dia) return iso;
    return `${dia}/${mes}/${ano}`;
}

/** Mais crítico primeiro (ordenação estável: empate mantém a ordem de origem). */
export function ordenarPorCriticidade<T extends { status: OportunidadeStatus }>(items: T[]): T[] {
    return [...items].sort((a, b) => statusMeta(a.status).ordem - statusMeta(b.status).ordem);
}

/** Contagem por status, já na ordem de criticidade — para os chips de filtro/resumo. */
export function contarPorStatus(oportunidades: Oportunidade[]): Array<[OportunidadeStatus, number]> {
    const contagem = new Map<OportunidadeStatus, number>();
    for (const item of oportunidades) {
        contagem.set(item.status, (contagem.get(item.status) ?? 0) + 1);
    }
    return [...contagem.entries()].sort((a, b) => statusMeta(a[0]).ordem - statusMeta(b[0]).ordem);
}

/** Formas plurais (os rótulos que não variam ficam iguais). */
const STATUS_PLURAL: Record<string, string> = {
    em_risco: 'em risco',
    pendente: 'pendentes',
    em_negociacao: 'em negociação',
    em_customizacao: 'em customização',
    nao_avancou: 'não avançou',
    perdida: 'perdidas',
};

/** "pendente"/"pendentes" conforme a quantidade. */
function rotuloComQuantidade(status: string, total: number): string {
    if (total === 1) return statusMeta(status).label.toLowerCase();
    return STATUS_PLURAL[status] ?? statusMeta(status).label.toLowerCase();
}

/** Resumo curto dos status para subtítulos: "1 em risco · 9 pendentes · 4 perdidas". */
export function resumoPorStatus(porStatus: Array<{ status: OportunidadeStatus; total: number }>): string {
    return porStatus.map((item) => `${item.total} ${rotuloComQuantidade(item.status, item.total)}`).join(' · ');
}

/**
 * Linha do gráfico "Por gerência": campos fixos + uma chave por status (é o que o
 * Recharts consome como `dataKey` de cada camada empilhada).
 */
export interface LinhaPorGerencia {
    gerencia: string;
    /** Rótulo do eixo: "Malde (KAM1) · 5". */
    label: string;
    gerente: string;
    total: number;
    valorIndicado: number;
    [status: string]: string | number;
}

/**
 * Monta as linhas do gráfico de barras empilhadas por gerência (total + contagem de cada
 * status). Mantém a ordem de `porGerencia` e ignora oportunidades de gerências ausentes.
 */
export function montarLinhasPorGerencia(
    porGerencia: Array<{ gerencia: string; gerenteNome: string; total: number; valorIndicado: number }>,
    oportunidades: Array<{ gerencia: string; status: OportunidadeStatus }>
): LinhaPorGerencia[] {
    const contagens = new Map<string, Map<OportunidadeStatus, number>>();
    for (const oportunidade of oportunidades) {
        const linha = contagens.get(oportunidade.gerencia) ?? new Map<OportunidadeStatus, number>();
        linha.set(oportunidade.status, (linha.get(oportunidade.status) ?? 0) + 1);
        contagens.set(oportunidade.gerencia, linha);
    }

    return porGerencia.map((g) => {
        const linha = contagens.get(g.gerencia) ?? new Map<OportunidadeStatus, number>();
        const row: LinhaPorGerencia = {
            gerencia: g.gerencia,
            gerente: g.gerenteNome || g.gerencia,
            label: `${g.gerenteNome || g.gerencia} (${g.gerencia}) · ${g.total}`,
            total: g.total,
            valorIndicado: g.valorIndicado,
        };
        for (const [status, total] of linha.entries()) row[status] = total;
        return row;
    });
}
