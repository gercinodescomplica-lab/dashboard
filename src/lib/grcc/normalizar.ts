/**
 * Normalização dos dados de lead da GRCC. A lógica de valor/data/município veio de
 * `src/services/cidades.service.ts` (quando a fonte era o Power Automate) e agora serve à
 * importação de planilha e à aba Cidades.
 */

import { CATEGORIAS_GRCC, type CategoriaGrcc } from './tipos';

const UFS_VALIDAS = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

/** Minúsculo, sem acento, espaços colapsados — base de todas as comparações de texto. */
export function chaveTexto(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Chave de casamento planilha × banco. */
export function chaveLead(cliente: string, solicitacao: string): string {
    return `${chaveTexto(cliente)}|${chaveTexto(solicitacao)}`;
}

/** Texto aparado ou `null` (vazio e erros de fórmula do Excel viram `null`). */
export function textoOuNull(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s || s === '#VALUE!' || s === '#VALOR!' || s === '#N/A' || s === '#REF!') return null;
    return s;
}

/**
 * Valor em reais vindo do Excel: "R$ 9.099.830,44", "349,020,12", "1.047.060", "4239525,6", número.
 * Vazio → 0. Texto sem dígito → `null` (ilegível).
 */
export function parseValorBRL(valor: unknown): number | null {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (valor === null || valor === undefined) return 0;
    const s = String(valor).trim();
    if (!s) return 0;

    const clean = s.replace(/[^0-9.,]/g, '');
    if (!clean) return null;

    let formatted = clean;
    if (clean.includes(',')) {
        const parts = clean.split(',');
        const decimal = parts[parts.length - 1];
        const integer = parts.slice(0, parts.length - 1).join('').replace(/\./g, '');
        formatted = `${integer}.${decimal}`;
    } else if (clean.includes('.')) {
        const lastDotIndex = clean.lastIndexOf('.');
        const decimalPart = clean.substring(lastDotIndex + 1);
        if (decimalPart.length === 2) {
            const intPart = clean.substring(0, lastDotIndex).replace(/\./g, '');
            formatted = `${intPart}.${decimalPart}`;
        } else {
            formatted = clean.replace(/\./g, '');
        }
    }

    const num = Number(formatted);
    return Number.isFinite(num) ? num : null;
}

function iso(y: number, m: number, d: number): string | null {
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Data do Excel (serial, Date, dd/mm/aa(aa), ISO) → "YYYY-MM-DD" ou `null`. */
export function parseDataIso(valor: unknown): string | null {
    if (valor instanceof Date) {
        if (Number.isNaN(valor.getTime())) return null;
        return iso(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
    }
    if (valor === null || valor === undefined) return null;
    const raw = String(valor).trim();
    if (!raw) return null;

    const serial = Number(raw);
    if (Number.isFinite(serial) && serial > 20000 && serial < 70000) {
        const d = new Date((serial - 25569) * 86400 * 1000);
        return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }

    const mIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return iso(Number(mIso[1]), Number(mIso[2]), Number(mIso[3]));

    const mBarra = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (mBarra) {
        let y = Number(mBarra[3]);
        if (y < 100) y += 2000;
        return iso(y, Number(mBarra[2]), Number(mBarra[1]));
    }
    return null;
}

/**
 * Data do lead para os cálculos da aba Cidades (previsão do mês / 90 dias / linha do tempo).
 * Mantém o contrato da função homônima que existia em `cidades.service.ts`, inclusive o
 * último recurso de `new Date(texto)` para formatos textuais não reconhecidos acima.
 */
export function extractLeadDate(lead: { previsao_fechamento?: string }): Date | null {
    const isoStr = parseDataIso(lead.previsao_fechamento);
    if (isoStr) {
        const [y, m, d] = isoStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const raw = textoOuNull(lead.previsao_fechamento);
    if (!raw) return null;
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

const CATEGORIA_POR_CHAVE = new Map<string, CategoriaGrcc>(CATEGORIAS_GRCC.map((c) => [chaveTexto(c), c]));
const ALIASES_CATEGORIA: Record<string, CategoriaGrcc> = {
    'em trataivas': 'Em tratativas',
    'em tratatativas': 'Em tratativas',
    tratativas: 'Em tratativas',
    validacao: 'Validação',
    'sem classificacao': 'Novo',
    lead: 'Novo',
    perdido: 'Perda',
    perdida: 'Perda',
    ganho: 'Contratado',
};

/** Categoria da planilha → categoria canônica. Desconhecida/vazia → `Novo`. */
export function normalizarCategoria(valor: unknown): CategoriaGrcc {
    const chave = chaveTexto(String(valor ?? ''));
    if (!chave) return 'Novo';
    return CATEGORIA_POR_CHAVE.get(chave) ?? ALIASES_CATEGORIA[chave] ?? 'Novo';
}

export function normalizarUf(valor: unknown): string | null {
    const uf = String(valor ?? '').trim().toUpperCase();
    return UFS_VALIDAS.has(uf) ? uf : null;
}

/** Quando a coluna município vem quebrada (#VALUE!), deduz pelo nome do cliente. */
export function municipioDoCliente(cliente: string): string {
    const s = cliente.trim();
    const matchDe = s.match(/\bde\s+([A-Za-zÀ-ÿ\s-]+?)\s*(?:\([A-Z]{2}\))?\s*$/i);
    if (matchDe) return matchDe[1].trim();
    return s
        .replace(/^(Prefeitura|Câmara Municipal|Camara Municipal|Assembleia Legislativa|Secretaria|Governo)\s+(do|da|de|dos|das)?\s*/i, '')
        .replace(/\s*\([A-Z]{2}\)\s*$/, '')
        .trim();
}
