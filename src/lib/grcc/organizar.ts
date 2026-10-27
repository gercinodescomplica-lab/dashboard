import { CAMPOS_COMERCIAIS, CATEGORIAS_GRCC, type CategoriaGrcc, type EventoComercial, type EventoHistorico, type LeadGrcc } from './tipos';
import { pendenciasDoLead } from './validacao';

export interface RegistroAndamento {
    /** Id do evento que GRAVOU o andamento (é ele que se corrige/remove). */
    id: number;
    quando: string;
    autor: string;
    texto: string;
    /** Quando o texto foi corrigido pela última vez (ausente = nunca corrigido). */
    editadoEm?: string;
}

const ehAjuste = (ev: EventoHistorico) => ev.origem === 'correcao' || ev.origem === 'remocao';

/**
 * Correções aplicadas, por id do evento original: texto novo, ou `null` se o andamento foi removido.
 * Aplicadas em ordem cronológica — a última correção vence.
 */
export function correcoesDeAndamento(eventos: EventoHistorico[]): Map<number, { texto: string; quando: string } | null> {
    const mapa = new Map<number, { texto: string; quando: string } | null>();
    const ajustes = eventos.filter((ev) => ehAjuste(ev) && typeof ev.corrige === 'number');
    ajustes.sort((a, b) => a.quando.localeCompare(b.quando) || a.id - b.id);
    for (const ev of ajustes) {
        const alvo = ev.corrige as number;
        if (ev.origem === 'remocao') {
            mapa.set(alvo, null);
            continue;
        }
        const para = ev.mudancas.find((m) => m.campo === 'status')?.para;
        if (para !== null && para !== undefined && String(para).trim() !== '') mapa.set(alvo, { texto: String(para), quando: ev.quando });
    }
    return mapa;
}

/** Cada andamento do lead (com as correções aplicadas e sem os removidos), mais recente primeiro. */
export function linhaDoTempoAndamento(eventos: EventoHistorico[]): RegistroAndamento[] {
    const correcoes = correcoesDeAndamento(eventos);
    const registros: RegistroAndamento[] = [];
    for (const ev of eventos) {
        if (ehAjuste(ev)) continue;
        const m = ev.mudancas.find((x) => x.campo === 'status');
        if (!m || m.para === null || String(m.para).trim() === '') continue;
        const c = correcoes.get(ev.id);
        if (c === null) continue;
        const registro: RegistroAndamento = { id: ev.id, quando: ev.quando, autor: ev.autor, texto: c ? c.texto : String(m.para) };
        if (c) registro.editadoEm = c.quando;
        registros.push(registro);
    }
    return registros.sort((a, b) => b.quando.localeCompare(a.quando) || b.id - a.id);
}

/**
 * Recorte do histórico que pode aparecer fora da GRCC, mais recente primeiro.
 * Descarta exclusões e qualquer campo que não seja comercial; a entrada no cadastro
 * (cadastro manual ou primeira importação) vira um evento `inicio` sem detalhes.
 */
export function eventosComerciais(eventos: EventoHistorico[]): EventoComercial[] {
    const saida: EventoComercial[] = [];
    let entrou = false;
    // Do mais antigo pro mais novo: só a PRIMEIRA entrada vira "entrou no cadastro"; reimportações depois disso
    // que só preenchem campos vazios contam como mudanças normais (se forem comerciais).
    const ordenados = [...eventos].sort((a, b) => a.quando.localeCompare(b.quando) || a.id - b.id);
    const correcoes = correcoesDeAndamento(eventos);
    for (const ev of ordenados) {
        if (ev.origem === 'exclusao' || ehAjuste(ev)) continue;
        const entrada = !entrou && (ev.origem === 'cadastro' || (ev.origem === 'importacao' && ev.mudancas.every((m) => m.de === null)));
        if (entrada) {
            entrou = true;
            saida.push({ id: ev.id, quando: ev.quando, inicio: true, mudancas: [] });
            continue;
        }
        const mudancas = ev.mudancas
            .filter((m) => CAMPOS_COMERCIAIS.includes(m.campo) && m.para !== null && m.para !== '')
            .flatMap((m) => {
                if (m.campo !== 'status' || !correcoes.has(ev.id)) return [m];
                const c = correcoes.get(ev.id);
                return c ? [{ ...m, para: c.texto }] : [];
            });
        if (mudancas.length > 0) saida.push({ id: ev.id, quando: ev.quando, inicio: false, mudancas });
    }
    return saida.sort((a, b) => b.quando.localeCompare(a.quando) || b.id - a.id);
}

export interface GrupoCidade {
    chave: string;
    rotulo: string;
    uf: string;
    municipio: string;
    leads: LeadGrcc[];
    valorAtivo: number;
    porCategoria: Partial<Record<CategoriaGrcc, number>>;
}

const SEM_CIDADE = 'Sem cidade';

export function agruparPorCidade(leads: LeadGrcc[]): GrupoCidade[] {
    const grupos = new Map<string, GrupoCidade>();
    for (const l of leads) {
        const chave = l.municipio ? `${l.uf}|${l.municipio}` : SEM_CIDADE;
        let g = grupos.get(chave);
        if (!g) {
            g = {
                chave,
                rotulo: l.municipio ? `${l.municipio} · ${l.uf}` : SEM_CIDADE,
                uf: l.municipio ? l.uf ?? '' : '',
                municipio: l.municipio ?? '',
                leads: [],
                valorAtivo: 0,
                porCategoria: {},
            };
            grupos.set(chave, g);
        }
        g.leads.push(l);
        if (l.categoria !== 'Perda') g.valorAtivo += l.valor;
        g.porCategoria[l.categoria] = (g.porCategoria[l.categoria] ?? 0) + 1;
    }
    return [...grupos.values()].sort((a, b) => {
        if (a.chave === SEM_CIDADE) return -1;
        if (b.chave === SEM_CIDADE) return 1;
        return a.uf.localeCompare(b.uf) || a.municipio.localeCompare(b.municipio, 'pt-BR');
    });
}

export type ColunaOrdem = 'cliente' | 'solicitacao' | 'categoria' | 'valor' | 'previsao' | 'atualizado';
export type DirecaoOrdem = 'asc' | 'desc';
export interface Ordem {
    coluna: ColunaOrdem;
    direcao: DirecaoOrdem;
}

export const COLUNAS_ORDEM: ColunaOrdem[] = ['cliente', 'solicitacao', 'categoria', 'valor', 'previsao', 'atualizado'];
export const ORDEM_PADRAO: Ordem = { coluna: 'atualizado', direcao: 'desc' };

/** Direção do 1º clique: texto e funil começam do início; valor e "atualizado" do maior; previsão da mais próxima. */
export const DIRECAO_INICIAL: Record<ColunaOrdem, DirecaoOrdem> = {
    cliente: 'asc',
    solicitacao: 'asc',
    categoria: 'asc',
    valor: 'desc',
    previsao: 'asc',
    atualizado: 'desc',
};

/** Clique no cabeçalho: mesma coluna inverte; coluna nova começa na direção natural dela. */
export function alternarOrdem(atual: Ordem, coluna: ColunaOrdem): Ordem {
    if (atual.coluna === coluna) return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
    return { coluna, direcao: DIRECAO_INICIAL[coluna] };
}

export function ordemValida(v: unknown): v is Ordem {
    const o = v as Ordem;
    return !!o && COLUNAS_ORDEM.includes(o.coluna) && (o.direcao === 'asc' || o.direcao === 'desc');
}

const POSICAO_NO_FUNIL = new Map<string, number>(CATEGORIAS_GRCC.map((c, i) => [c, i]));
const texto = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Valor comparável da coluna; `null` = vazio (sem valor, sem previsão…), que vai SEMPRE para o fim. */
function chaveDe(l: LeadGrcc, coluna: ColunaOrdem): string | number | null {
    switch (coluna) {
        case 'cliente':
            return l.cliente.trim() || null;
        case 'solicitacao':
            return l.solicitacao.trim() || null;
        case 'categoria':
            return POSICAO_NO_FUNIL.get(l.categoria) ?? CATEGORIAS_GRCC.length;
        case 'valor':
            return l.valor > 0 ? l.valor : null;
        case 'previsao':
            return l.previsaoFechamento || null;
        case 'atualizado':
            return l.atualizadoEm || null;
    }
}

/** Ordena sem mutar. Vazios ficam no fim nas duas direções; empate desempata por cliente (A→Z) e id. */
export function ordenarLeads(leads: LeadGrcc[], ordem: Ordem): LeadGrcc[] {
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    return [...leads].sort((a, b) => {
        const ka = chaveDe(a, ordem.coluna);
        const kb = chaveDe(b, ordem.coluna);
        if (ka === null && kb !== null) return 1;
        if (kb === null && ka !== null) return -1;
        if (ka !== null && kb !== null && ka !== kb) {
            const c = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : texto.compare(String(ka), String(kb));
            if (c !== 0) return c * sinal;
        }
        return texto.compare(a.cliente, b.cliente) || a.id - b.id;
    });
}

/** Próximo lead com pendência de cadastro, na ordem da lista, pulando os já vistos. */
export function proximoPendente(leads: LeadGrcc[], vistos: Set<number>): number | null {
    return leads.find((l) => !vistos.has(l.id) && pendenciasDoLead(l).length > 0)?.id ?? null;
}
