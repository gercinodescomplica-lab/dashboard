'use server';

/**
 * Oportunidades em risco — bloco exibido no fim da tela inicial do gerente e KPI
 * consolidado do dashboard principal (DRM).
 *
 * ┌─ ORIGEM DOS DADOS ────────────────────────────────────────────────────────┐
 * │ HOJE: levantamento estático em `src/data/oportunidades-consolidado.json`. │
 * │ DEPOIS: tabela no banco. Para migrar, troque APENAS `parseConsolidado()`  │
 * │ por uma query Drizzle (exemplo no fim do arquivo) mantendo o retorno —    │
 * │ as duas actions e a UI não mudam.                                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

import consolidado from '@/data/oportunidades-consolidado.json';
import type {
    Oportunidade,
    OportunidadeComGerencia,
    OportunidadeStatus,
    OportunidadesRiscoConsolidado,
    OportunidadesRiscoData,
    OportunidadesRiscoPorGerencia,
} from '@/types/oportunidades';
import { contarPorStatus, ordenarPorCriticidade } from '@/lib/oportunidades';

/* ────────────────────────────────────────────────────────────────────────────
 * Formato cru do JSON (snake_case). Este é o ÚNICO ponto do código que conhece
 * esse formato: daqui para fora tudo é camelCase (igual às queries do banco).
 * ──────────────────────────────────────────────────────────────────────────── */

interface RawOportunidade {
    orgao?: string | null;
    produto_tema?: string | null;
    tinha_proposta_formal?: boolean | null;
    valor_indicado?: number | null;
    envolvidos?: string[] | null;
    area_bloqueadora?: string | null;
    status?: string | null;
    causa_raiz?: string | null;
    descricao?: string | null;
}

interface RawGerente {
    gerente_id?: string;
    gerente_nome?: string;
    data_coleta?: string | null;
    oportunidades?: RawOportunidade[];
}

interface RawConsolidado {
    levantamento?: string;
    data_consolidacao?: string | null;
    gerentes?: RawGerente[];
}

const RAW = consolidado as unknown as RawConsolidado;

const STATUS_VALIDOS: OportunidadeStatus[] = [
    'em_risco',
    'pendente',
    'em_negociacao',
    'em_customizacao',
    'nao_avancou',
    'perdida',
];

/** Status neutro para valores novos que o levantamento traga antes da UI conhecer. */
const STATUS_FALLBACK: OportunidadeStatus = 'pendente';

/** Compara códigos de gerência ignorando caixa, hífen e acento de separador ("GRC-1" == "grc1"). */
function normalizeKey(value: string | null | undefined): string {
    return (value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function normalizeEnvolvidos(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeValor(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function normalizeOportunidade(raw: RawOportunidade): Oportunidade {
    const statusBruto = (raw.status ?? '').trim().toLowerCase();
    let status = STATUS_VALIDOS.find((s) => s === statusBruto);
    if (!status) {
        console.warn(
            `[oportunidades] status desconhecido "${raw.status}" em "${raw.orgao ?? '?'}" — exibindo como "${STATUS_FALLBACK}".`
        );
        status = STATUS_FALLBACK;
    }

    return {
        orgao: raw.orgao?.trim() || 'Órgão não informado',
        produtoTema: raw.produto_tema?.trim() || 'Tema não informado',
        tinhaPropostaFormal:
            typeof raw.tinha_proposta_formal === 'boolean' ? raw.tinha_proposta_formal : null,
        valorIndicado: normalizeValor(raw.valor_indicado),
        envolvidos: normalizeEnvolvidos(raw.envolvidos),
        areaBloqueadora: raw.area_bloqueadora?.trim() || null,
        status,
        causaRaiz: raw.causa_raiz?.trim() || 'nao_informada',
        descricao: raw.descricao?.trim() || '',
    };
}

interface GerenteNormalizado {
    gerencia: string;
    gerenteNome: string;
    dataColeta: string | null;
    oportunidades: Oportunidade[];
}

/**
 * Lê o levantamento inteiro já normalizado (camelCase).
 *
 * É o único ponto que conhece o formato de origem — quando os dados vierem do banco,
 * basta reescrever esta função (ver receita no fim do arquivo).
 */
function parseConsolidado(): {
    levantamento: string;
    dataConsolidacao: string | null;
    gerentes: GerenteNormalizado[];
} {
    const gerentes = (RAW.gerentes ?? [])
        .map((g) => ({
            gerencia: g.gerente_id?.trim() || '',
            gerenteNome: g.gerente_nome?.trim() || '',
            dataColeta: g.data_coleta?.trim() || null,
            oportunidades: (g.oportunidades ?? []).map(normalizeOportunidade),
        }))
        .filter((g) => g.gerencia !== '');

    return {
        levantamento: RAW.levantamento?.trim() || 'Oportunidades em risco',
        dataConsolidacao: RAW.data_consolidacao?.trim() || null,
        gerentes,
    };
}

/**
 * Oportunidades em risco da gerência do gerente logado.
 *
 * O casamento é feito pelo **código da gerência** (`manager.role`: "KAM1", "GRC1",
 * "GRCC"...) porque é a chave usada no levantamento (`gerente_id`). Isso deixa de
 * fora, de propósito, gerentes cujo código não está no levantamento (ex.: conta de
 * teste "KAM10") e evita casamento errado por prefixo ("KAM1" × "KAM10").
 * Se `role` vier vazio, cai para o prefixo do id ("kam1-malde" → "KAM1").
 *
 * @returns `null` quando não existe levantamento para o gerente.
 */
export async function getOportunidadesRisco(
    managerRole: string,
    managerId?: string
): Promise<OportunidadesRiscoData | null> {
    const chaves = new Set<string>();
    const roleKey = normalizeKey(managerRole);
    if (roleKey) chaves.add(roleKey);
    if (!roleKey && managerId) {
        const idPrefix = normalizeKey(managerId.split('-')[0]);
        if (idPrefix) chaves.add(idPrefix);
    }
    if (chaves.size === 0) return null;

    const consolidado = parseConsolidado();
    const gerente = consolidado.gerentes.find((g) => chaves.has(normalizeKey(g.gerencia)));
    if (!gerente) return null;

    return {
        gerencia: gerente.gerencia,
        gerenteNome: gerente.gerenteNome,
        dataColeta: gerente.dataColeta,
        levantamento: consolidado.levantamento,
        dataConsolidacao: consolidado.dataConsolidacao,
        oportunidades: gerente.oportunidades,
    };
}

/**
 * Levantamento consolidado de **todas** as gerências — alimenta o KPI e o modal de
 * "Oportunidades em Risco" do dashboard principal (DRM).
 *
 * Escopo do total: todas as oportunidades do levantamento ("não avançadas ou pendentes
 * por falha interna"), somando todos os status. As listas já saem ordenadas por
 * criticidade (mais crítico primeiro) e a de oportunidades vem achatada com o código da
 * gerência de origem.
 *
 * @returns `null` quando o levantamento está vazio.
 */
export async function getOportunidadesRiscoConsolidado(): Promise<OportunidadesRiscoConsolidado | null> {
    const consolidado = parseConsolidado();
    if (consolidado.gerentes.length === 0) return null;

    const porGerencia: OportunidadesRiscoPorGerencia[] = [];
    const comGerencia: OportunidadeComGerencia[] = [];

    for (const gerente of consolidado.gerentes) {
        let valorGerencia = 0;
        for (const oportunidade of gerente.oportunidades) {
            valorGerencia += oportunidade.valorIndicado ?? 0;
            comGerencia.push({
                ...oportunidade,
                gerencia: gerente.gerencia,
                gerenteNome: gerente.gerenteNome,
                dataColeta: gerente.dataColeta,
            });
        }
        porGerencia.push({
            gerencia: gerente.gerencia,
            gerenteNome: gerente.gerenteNome,
            total: gerente.oportunidades.length,
            valorIndicado: valorGerencia,
        });
    }

    return {
        levantamento: consolidado.levantamento,
        dataConsolidacao: consolidado.dataConsolidacao,
        total: comGerencia.length,
        totalGerentes: consolidado.gerentes.length,
        valorIndicadoTotal: porGerencia.reduce((acc, g) => acc + g.valorIndicado, 0),
        porStatus: contarPorStatus(comGerencia).map(([status, total]) => ({ status, total })),
        porGerencia,
        oportunidades: ordenarPorCriticidade(comGerencia),
    };
}

/* ────────────────────────────────────────────────────────────────────────────
 * COMO MIGRAR PARA O BANCO (quando o schema estiver definido)
 *
 * 1. Criar a tabela no `src/db/schema.ts`, ex.:
 *
 *      export const oportunidadeRisco = sqliteTable('oportunidade_risco', {
 *          id: integer('id').primaryKey({ autoIncrement: true }),
 *          gerencia: text('gerencia').notNull(),           // "KAM1", "GRCC"...
 *          orgao: text('orgao').notNull(),
 *          produtoTema: text('produto_tema').notNull(),
 *          tinhaPropostaFormal: integer('tinha_proposta_formal', { mode: 'boolean' }),
 *          valorIndicado: real('valor_indicado'),
 *          envolvidos: text('envolvidos'),                 // JSON string
 *          areaBloqueadora: text('area_bloqueadora'),
 *          status: text('status').notNull(),
 *          causaRaiz: text('causa_raiz').notNull(),
 *          descricao: text('descricao'),
 *          dataColeta: text('data_coleta'),
 *      });
 *
 * 2. Trocar o corpo de `parseConsolidado()` por algo como:
 *
 *      const rows = await db.select().from(oportunidadeRisco);
 *      return {
 *          levantamento: 'Oportunidades não avançadas ou pendentes por falha interna',
 *          dataConsolidacao: MAX(data_coleta),
 *          gerentes: agruparPorGerencia(rows),
 *      };
 *
 * 3. `normalizeOportunidade` continua sendo o ponto único de saneamento — basta
 *    apontá-la para as linhas do banco. As duas actions (`getOportunidadesRisco` e
 *    `getOportunidadesRiscoConsolidado`) e as UIs (tela do gerente e dashboard
 *    principal) não mudam.
 * ──────────────────────────────────────────────────────────────────────────── */
