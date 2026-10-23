/**
 * Planilha (.xlsx já lido como matriz) → leads normalizados. Puro: quem lê o arquivo é o
 * `ImportarExcelDialog` (read-excel-file, no navegador). Colunas são achadas pelo NOME do
 * cabeçalho (aliases), nunca pela posição.
 */

import { LEAD_VAZIO, type LeadGrccDados, type LinhaPlanilha, type ProblemaLinha, type ResultadoPlanilha } from './tipos';
import {
    chaveLead,
    chaveTexto,
    municipioDoCliente,
    normalizarCategoria,
    normalizarUf,
    parseDataIso,
    parseValorBRL,
    textoOuNull,
} from './normalizar';
import { acharMunicipio } from './municipios';
import { validarLead } from './validacao';

/** Aliases já normalizados por `chaveCabecalho`. A ordem importa: o primeiro achado vence. */
export const ALIASES_COLUNA: Record<keyof LeadGrccDados, string[]> = {
    cliente: ['cliente', 'orgao', 'orgao cliente'],
    solicitacao: ['solicitacao', 'solicitacao padrao', 'demanda'],
    status: ['status', 'andamento'],
    categoria: ['categoria padrao', 'categoria'],
    etapa: ['etapa padrao', 'etapa'],
    situacao: ['situacao padrao', 'situacao'],
    motivoPerda: ['motivo padrao', 'motivo da perda', 'motivo'],
    familiaDemanda: ['familia demanda', 'familia da demanda', 'familia'],
    valor: ['valor', 'valor r', 'valor estimado'],
    uf: ['uf', 'estado'],
    municipio: ['municipio', 'cidade'],
    regiao: ['regiao'],
    contatoNome: ['contato nome', 'contato', 'nome do contato'],
    contatoEmail: ['contato email', 'email', 'e mail'],
    contatoTelefone: ['contato telefone', 'telefone'],
    previsaoFechamento: ['previsao fechamento', 'previsao de fechamento', 'previsao'],
    inicioFaturamento: ['inicio faturamento', 'inicio do faturamento'],
    duracaoMeses: ['duracao meses', 'duracao', 'prazo meses'],
};

export const COLUNAS_OBRIGATORIAS: { campo: keyof LeadGrccDados; rotulo: string }[] = [
    { campo: 'cliente', rotulo: 'Cliente' },
    { campo: 'valor', rotulo: 'Valor' },
    { campo: 'uf', rotulo: 'UF' },
];

/** "Previsão de Fechamento" / "previsao_fechamento" → "previsao de fechamento". */
function chaveCabecalho(v: unknown): string {
    return chaveTexto(String(v ?? '').replace(/[_\-.:/()$]/g, ' '));
}

function mapearCabecalho(cab: unknown[]): Partial<Record<keyof LeadGrccDados, number>> {
    const chaves = cab.map(chaveCabecalho);
    const mapa: Partial<Record<keyof LeadGrccDados, number>> = {};
    for (const [campo, aliases] of Object.entries(ALIASES_COLUNA) as [keyof LeadGrccDados, string[]][]) {
        for (const alias of aliases) {
            const idx = chaves.indexOf(alias);
            if (idx >= 0) {
                mapa[campo] = idx;
                break;
            }
        }
    }
    return mapa;
}

function linhaVazia(row: unknown[]): boolean {
    return row.every((c) => textoOuNull(c) === null);
}

export function lerLinhasPlanilha(matriz: unknown[][]): ResultadoPlanilha {
    const [cab = [], ...corpo] = matriz;
    const mapa = mapearCabecalho(cab);

    const colunasFaltando = COLUNAS_OBRIGATORIAS.filter((c) => mapa[c.campo] === undefined).map((c) => c.rotulo);
    if (colunasFaltando.length > 0) return { linhas: [], problemas: [], colunasFaltando };

    const cel = (row: unknown[], campo: keyof LeadGrccDados): unknown => {
        const idx = mapa[campo];
        return idx === undefined ? null : row[idx];
    };

    const linhas: LinhaPlanilha[] = [];
    const problemas: ProblemaLinha[] = [];

    corpo.forEach((row, i) => {
        const numero = i + 2; // linha 1 do Excel é o cabeçalho
        if (!row || linhaVazia(row)) return;

        const cliente = textoOuNull(cel(row, 'cliente')) ?? '';
        const solicitacao = textoOuNull(cel(row, 'solicitacao')) ?? '';
        const status = textoOuNull(cel(row, 'status'));
        const ufBruta = textoOuNull(cel(row, 'uf'));

        // Linha-título de seção ("Propostas Perdidas") — sem mais nada preenchido.
        if (chaveTexto(cliente) === 'propostas perdidas' && !solicitacao && !status && !ufBruta) return;

        if (!cliente) {
            problemas.push({ linha: numero, cliente: '', motivo: 'Cliente vazio' });
            return;
        }

        const valorBruto = cel(row, 'valor');
        const valor = parseValorBRL(valorBruto);
        if (valor === null) {
            problemas.push({ linha: numero, cliente, motivo: `Valor ilegível: "${String(valorBruto)}"` });
            return;
        }

        const uf = ufBruta ? normalizarUf(ufBruta) : null;
        if (ufBruta && !uf) {
            problemas.push({ linha: numero, cliente, motivo: `UF inválida: "${ufBruta}"` });
            return;
        }

        const municipioBruto = textoOuNull(cel(row, 'municipio')) ?? municipioDoCliente(cliente);
        const municipio = uf ? acharMunicipio(uf, municipioBruto) : null;

        const duracao = Number(textoOuNull(cel(row, 'duracaoMeses')));

        const dados: LeadGrccDados = {
            ...LEAD_VAZIO,
            cliente,
            solicitacao,
            status,
            categoria: normalizarCategoria(cel(row, 'categoria')),
            etapa: textoOuNull(cel(row, 'etapa')),
            situacao: textoOuNull(cel(row, 'situacao')),
            motivoPerda: textoOuNull(cel(row, 'motivoPerda')),
            familiaDemanda: textoOuNull(cel(row, 'familiaDemanda')),
            valor,
            uf,
            municipio,
            regiao: textoOuNull(cel(row, 'regiao')),
            contatoNome: textoOuNull(cel(row, 'contatoNome')),
            contatoEmail: textoOuNull(cel(row, 'contatoEmail')),
            contatoTelefone: textoOuNull(cel(row, 'contatoTelefone')),
            previsaoFechamento: parseDataIso(cel(row, 'previsaoFechamento')),
            inicioFaturamento: parseDataIso(cel(row, 'inicioFaturamento')),
            duracaoMeses: Number.isInteger(duracao) && duracao > 0 ? duracao : 12,
        };
        // Mesma regra que o servidor aplica em confirmarImportacao: o que ele recusaria aparece já aqui.
        const v = validarLead(dados, { modo: 'importacao' });
        if (!v.ok) {
            problemas.push({ linha: numero, cliente, motivo: Object.values(v.erros).join(' ') });
            return;
        }
        linhas.push({ linha: numero, dados: v.dados });
    });

    // Duplicadas dentro da própria planilha: as duas saem para "com problema".
    const porChave = new Map<string, LinhaPlanilha[]>();
    for (const l of linhas) {
        const k = chaveLead(l.dados.cliente, l.dados.solicitacao);
        porChave.set(k, [...(porChave.get(k) ?? []), l]);
    }
    const duplicadas = new Set<number>();
    for (const grupo of porChave.values()) {
        if (grupo.length < 2) continue;
        for (const l of grupo) {
            duplicadas.add(l.linha);
            const outras = grupo.filter((o) => o !== l).map((o) => o.linha).join(', ');
            problemas.push({
                linha: l.linha,
                cliente: l.dados.cliente,
                motivo: `Duplicada (mesmo cliente e solicitação da linha ${outras})`,
            });
        }
    }

    problemas.sort((a, b) => a.linha - b.linha);
    return {
        linhas: linhas.filter((l) => !duplicadas.has(l.linha)),
        problemas,
        colunasFaltando: [],
    };
}
