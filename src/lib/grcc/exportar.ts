/**
 * Leads → planilha (.xlsx) para download. Puro: quem grava o arquivo é o `LeadsGrccTable`
 * (write-excel-file, no navegador). Os cabeçalhos seguem o layout da planilha original da GRCC e
 * todos casam com `ALIASES_COLUNA`, então o arquivo baixado pode voltar pela importação.
 */

import type { Row, SheetData } from 'write-excel-file/browser';
import { ROTULO_TEMPERATURA, type LeadGrcc, type LeadGrccDados } from './tipos';
import { chaveTexto } from './normalizar';

type Coluna = {
    cabecalho: string;
    largura: number;
    celula: (l: LeadGrcc) => Row[number];
};

const FORMATO_DATA = 'dd/mm/yyyy';
const FORMATO_BRL = '"R$" #,##0.00';

const texto = (v: string | null) => (v ? { value: v, type: String } : null);

/** "2026-03-15" → Date em UTC (o Excel mostra o dia certo e a importação lê de volta igual). */
function data(iso: string | null): Row[number] {
    if (!iso) return null;
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return null;
    return { value: new Date(Date.UTC(a, m - 1, d)), type: Date, format: FORMATO_DATA };
}

const campo = (cabecalho: string, largura: number, c: keyof LeadGrccDados): Coluna => ({
    cabecalho,
    largura,
    celula: (l) => texto(l[c] as string | null),
});

export const COLUNAS_EXPORTACAO: Coluna[] = [
    campo('Cliente', 40, 'cliente'),
    campo('Solicitação', 40, 'solicitacao'),
    campo('Status', 40, 'status'),
    campo('Categoria', 14, 'categoria'),
    { cabecalho: 'Temperatura', largura: 12, celula: (l) => texto(l.temperatura ? ROTULO_TEMPERATURA[l.temperatura] : null) },
    campo('Etapa Padrão', 24, 'etapa'),
    campo('Situação Padrão', 20, 'situacao'),
    campo('Motivo Padrão', 24, 'motivoPerda'),
    campo('Família Demanda', 24, 'familiaDemanda'),
    { cabecalho: 'Valor', largura: 16, celula: (l) => ({ value: l.valor, type: Number, format: FORMATO_BRL }) },
    campo('UF', 6, 'uf'),
    campo('Município', 24, 'municipio'),
    campo('Região', 14, 'regiao'),
    campo('Contato Nome', 24, 'contatoNome'),
    campo('Contato Email', 30, 'contatoEmail'),
    campo('Contato Telefone', 18, 'contatoTelefone'),
    { cabecalho: 'Previsão de fechamento', largura: 14, celula: (l) => data(l.previsaoFechamento) },
    { cabecalho: 'Início do faturamento', largura: 14, celula: (l) => data(l.inicioFaturamento) },
    { cabecalho: 'Duração (meses)', largura: 10, celula: (l) => ({ value: l.duracaoMeses, type: Number }) },
    // Só informativas: a importação ignora (visibilidade não vem da planilha; data é carimbo do sistema).
    { cabecalho: 'Visível no dashboard', largura: 12, celula: (l) => texto(l.visivelDashboard ? 'Sim' : 'Não') },
    { cabecalho: 'Atualizado em', largura: 14, celula: (l) => data(l.atualizadoEm) },
];

export function planilhaDosLeads(leads: LeadGrcc[]): SheetData {
    const cabecalho: Row = COLUNAS_EXPORTACAO.map((c) => ({ value: c.cabecalho, fontWeight: 'bold' as const }));
    return [cabecalho, ...leads.map((l) => COLUNAS_EXPORTACAO.map((c) => c.celula(l)))];
}

export const LARGURAS_EXPORTACAO = COLUNAS_EXPORTACAO.map((c) => ({ width: c.largura }));

/** "leads-grcc-em-tratativas-quente-2026-10-27.xlsx" — partes vazias somem. */
export function nomeArquivoExportacao(partes: (string | null | undefined)[], hoje = new Date()): string {
    const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const slugs = partes.map((p) => chaveTexto(p ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean);
    return ['leads-grcc', ...slugs, dia].join('-') + '.xlsx';
}
