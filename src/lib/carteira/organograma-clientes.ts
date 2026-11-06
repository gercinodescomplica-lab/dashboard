// Organograma de clientes: quem atende cada órgão, montado a partir da carteira. Código puro, sem leitura de dados.
// Cópia do AIBertinho (modulos/gerencias/regras/organograma-clientes.ts).
import { chaveDaGerencia } from '@/lib/integracao/chaves';

export type GrupoDaGerencia = 'kam' | 'grc' | 'grcc' | 'gerente';

export const ROTULO_DO_GRUPO: Record<GrupoDaGerencia, string> = {
    kam: 'KAM, contas-chave',
    grc: 'GRC, relacionamento',
    grcc: 'GRCC, fora do município',
    gerente: 'Gerente',
};

export const ORDEM_DOS_GRUPOS: GrupoDaGerencia[] = ['kam', 'grc', 'grcc', 'gerente'];

/** Cor de cada grupo, as mesmas do organograma de pessoas do dashboard. */
export const COR_DO_GRUPO: Record<GrupoDaGerencia, { faixa: string; texto: string; cabecalho: string; corpo: string }> = {
    kam: { faixa: 'bg-indigo-500', texto: 'text-indigo-400', cabecalho: 'bg-indigo-600 border-indigo-500', corpo: 'border-indigo-900/50' },
    grc: { faixa: 'bg-emerald-500', texto: 'text-emerald-400', cabecalho: 'bg-emerald-600 border-emerald-500', corpo: 'border-emerald-900/50' },
    grcc: { faixa: 'bg-zinc-500', texto: 'text-zinc-400', cabecalho: 'bg-zinc-600 border-zinc-500', corpo: 'border-zinc-700' },
    gerente: { faixa: 'bg-amber-500', texto: 'text-amber-500', cabecalho: 'bg-amber-600 border-amber-500', corpo: 'border-amber-900/50' },
};

/** Título e subtítulo do cabeçalho da coluna de cada grupo, como os departamentos do organograma de pessoas. */
export const CABECALHO_DO_GRUPO: Record<GrupoDaGerencia, { titulo: string; subtitulo: string }> = {
    kam: { titulo: 'KAM', subtitulo: 'Key Account Manager' },
    grc: { titulo: 'GRC', subtitulo: 'Gerência Rel. Comercial' },
    grcc: { titulo: 'GRCC', subtitulo: 'Fora do município' },
    gerente: { titulo: 'Gerentes', subtitulo: 'Outras carteiras' },
};

export interface ClienteDoOrganograma {
    id: string;
    nome: string;
    sigla: string | null;
    /** Último movimento de carteira do cliente, para a dica do item. */
    ultimoMovimento: { em: string } | null;
}

export interface GerenciaDoOrganograma {
    id: string;
    nome: string;
    sigla: string | null;
    ativa: boolean;
    gerentes: string[];
    clientes: ClienteDoOrganograma[];
}

export interface CartaoDoOrganograma extends GerenciaDoOrganograma {
    grupo: GrupoDaGerencia;
    /** O que aparece como "cargo" no cartão: a sigla ou, sem ela, o rótulo do grupo. */
    rotuloCargo: string;
}

export interface OrganogramaClientes {
    /** Colunas da tela, como no PDF: KAM empilhados, uma por GRC, e GRCC + gerentes empilhados no fim. */
    colunas: CartaoDoOrganograma[][];
    /** Os cartões na ordem da faixa de proporção (os mesmos das colunas, achatados). */
    cartoes: CartaoDoOrganograma[];
    semCarteira: ClienteDoOrganograma[];
    totais: { gerencias: number; orgaosAtendidos: number; maiorCarteira: { nome: string; clientes: number } | null };
}

/** "KAM2" → { grupo: 'kam', numero: 2 }; "GRC-C" → grcc; "Tríade" → gerente. Lê a sigla e, sem chave nela, o nome. */
export function grupoDaGerencia(g: { sigla: string | null; nome: string }): { grupo: GrupoDaGerencia; numero: number | null } {
    const chave = chaveDaGerencia(g.sigla) ?? chaveDaGerencia(g.nome);
    if (!chave) return { grupo: 'gerente', numero: null };
    if (chave === 'GRCC') return { grupo: 'grcc', numero: null };
    const m = /^(KAM|GRC)(\d+)$/.exec(chave);
    if (!m) return { grupo: 'gerente', numero: null };
    return { grupo: m[1] === 'KAM' ? 'kam' : 'grc', numero: Number(m[2]) };
}

function comparar(a: GerenciaDoOrganograma, b: GerenciaDoOrganograma): number {
    const ga = grupoDaGerencia(a);
    const gb = grupoDaGerencia(b);
    const porGrupo = ORDEM_DOS_GRUPOS.indexOf(ga.grupo) - ORDEM_DOS_GRUPOS.indexOf(gb.grupo);
    if (porGrupo !== 0) return porGrupo;
    if (ga.numero !== gb.numero) {
        if (ga.numero === null) return 1;
        if (gb.numero === null) return -1;
        return ga.numero - gb.numero;
    }
    return (a.gerentes[0] ?? a.nome).localeCompare(b.gerentes[0] ?? b.nome, 'pt-BR');
}

function porSiglaDoCliente(a: ClienteDoOrganograma, b: ClienteDoOrganograma): number {
    return (a.sigla ?? a.nome).localeCompare(b.sigla ?? b.nome, 'pt-BR');
}

/** Desativada só entra se ainda tem cliente (senão o cliente sumiria da tela). */
export function montarOrganograma(gerencias: GerenciaDoOrganograma[], semCarteira: ClienteDoOrganograma[]): OrganogramaClientes {
    const cartoes: CartaoDoOrganograma[] = gerencias
        .filter((g) => g.ativa || g.clientes.length > 0)
        .sort(comparar)
        .map((g) => {
            const { grupo } = grupoDaGerencia(g);
            return {
                ...g,
                clientes: [...g.clientes].sort(porSiglaDoCliente),
                grupo,
                rotuloCargo: g.sigla?.trim() || ROTULO_DO_GRUPO[grupo],
            };
        });

    const kam = cartoes.filter((c) => c.grupo === 'kam');
    const grc = cartoes.filter((c) => c.grupo === 'grc');
    const fim = cartoes.filter((c) => c.grupo === 'grcc' || c.grupo === 'gerente');
    const colunas = [kam, ...grc.map((c) => [c]), fim].filter((col) => col.length > 0);

    const comCliente = cartoes.filter((c) => c.clientes.length > 0);
    const maior = comCliente.reduce<CartaoDoOrganograma | null>((m, c) => (!m || c.clientes.length > m.clientes.length ? c : m), null);

    return {
        colunas,
        cartoes,
        semCarteira: [...semCarteira].sort(porSiglaDoCliente),
        totais: {
            gerencias: comCliente.length,
            orgaosAtendidos: comCliente.reduce((s, c) => s + c.clientes.length, 0),
            maiorCarteira: maior ? { nome: nomeDoCartao(maior), clientes: maior.clientes.length } : null,
        },
    };
}

/** Como o cartão se chama: os gerentes ("Ana e Beto") ou, sem gerente, o nome da gerência. */
export function nomeDoCartao(g: Pick<GerenciaDoOrganograma, 'gerentes' | 'nome'>): string {
    if (g.gerentes.length === 0) return g.nome;
    if (g.gerentes.length === 1) return g.gerentes[0];
    return `${g.gerentes.slice(0, -1).join(', ')} e ${g.gerentes[g.gerentes.length - 1]}`;
}

/** Como a gerência aparece no texto da confirmação: a sigla ou o nome; `null` = "Sem carteira". */
export function rotuloDoDestino(g: Pick<GerenciaDoOrganograma, 'sigla' | 'nome'> | null): string {
    if (!g) return 'Sem carteira';
    return g.sigla?.trim() || g.nome;
}
