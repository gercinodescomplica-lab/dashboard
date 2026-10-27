import { z } from 'zod';
import { CATEGORIAS_GRCC, TEMPERATURAS_LEAD, type LeadGrccDados } from './tipos';
import { acharMunicipio } from './municipios';

const textoOpcional = z.string().trim().transform((s) => (s === '' ? null : s)).nullable();

/** "YYYY-MM-DD" que existe no calendário (recusa 2026-02-31, 2026-22-10). */
function dataReal(s: string): boolean {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const dataOpcional = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .refine(dataReal, 'Data inválida.')
    .nullable()
    .or(z.literal('').transform(() => null));

export const schemaLead = z.object({
    cliente: z.string().trim().min(1, 'Informe o cliente.'),
    solicitacao: z.string().trim(),
    status: textoOpcional,
    categoria: z.enum(CATEGORIAS_GRCC, { message: 'Categoria inválida.' }),
    // Vazio/ausente = automático pela categoria.
    temperatura: z
        .union([z.enum(TEMPERATURAS_LEAD, { message: 'Temperatura inválida.' }), z.literal(''), z.null(), z.undefined()])
        .transform((v) => v || null),
    etapa: textoOpcional,
    situacao: textoOpcional,
    motivoPerda: textoOpcional,
    familiaDemanda: textoOpcional,
    valor: z.number({ message: 'Valor inválido.' }).finite('Valor inválido.').min(0, 'Valor não pode ser negativo.'),
    uf: textoOpcional,
    municipio: textoOpcional,
    regiao: textoOpcional,
    contatoNome: textoOpcional,
    contatoEmail: z.string().trim().email('E-mail inválido.').nullable().or(z.literal('').transform(() => null)),
    contatoTelefone: textoOpcional,
    previsaoFechamento: dataOpcional,
    inicioFaturamento: dataOpcional,
    duracaoMeses: z.number().int().min(1, 'Duração mínima de 1 mês.').max(120),
});

type Erros = Partial<Record<keyof LeadGrccDados, string>>;

const schemaEmail = schemaLead.shape.contatoEmail;

/**
 * Importação: o que a planilha traz ilegível mas não impede o lead de existir vira vazio
 * (e-mail inválido, telefone sem dígito) — a linha entra e o que faltar aparece em Pendências.
 */
function limparContatoDaPlanilha(entrada: unknown): unknown {
    if (!entrada || typeof entrada !== 'object') return entrada;
    const e = entrada as Record<string, unknown>;
    const email = typeof e.contatoEmail === 'string' && !schemaEmail.safeParse(e.contatoEmail).success ? null : e.contatoEmail;
    const telefone = typeof e.contatoTelefone === 'string' && !/\d/.test(e.contatoTelefone) ? null : e.contatoTelefone;
    return { ...e, contatoEmail: email, contatoTelefone: telefone };
}

/**
 * Uma regra só para tela e importação. `modo: 'importacao'` (prévia no navegador E servidor):
 * Perda sem motivo e Contratado sem início entram (são pendências, não bloqueio) e contato
 * ilegível vira vazio. Na tela (`exigirLocal`) tudo isso continua obrigatório.
 */
export function validarLead(
    entrada: unknown,
    opts: { exigirLocal?: boolean; modo?: 'tela' | 'importacao' } = {}
): { ok: true; dados: LeadGrccDados } | { ok: false; erros: Erros } {
    const importacao = opts.modo === 'importacao';
    const r = schemaLead.safeParse(importacao ? limparContatoDaPlanilha(entrada) : entrada);
    const erros: Erros = {};
    if (!r.success) {
        for (const issue of r.error.issues) {
            const campo = issue.path[0] as keyof LeadGrccDados;
            erros[campo] ??= issue.message;
        }
        return { ok: false, erros };
    }
    const d = r.data as LeadGrccDados;

    if (!importacao) {
        if (d.categoria === 'Perda' && !d.motivoPerda) erros.motivoPerda = 'Informe o motivo da perda.';
        if (d.categoria === 'Contratado' && !d.inicioFaturamento) erros.inicioFaturamento = 'Informe o início do faturamento.';
    }
    if (d.uf && d.municipio && !acharMunicipio(d.uf, d.municipio)) erros.municipio = `Município não encontrado em ${d.uf}.`;
    if (opts.exigirLocal) {
        if (!d.solicitacao) erros.solicitacao = 'Informe a solicitação.';
        if (!d.uf) erros.uf = 'Informe a UF.';
        if (!d.municipio) erros.municipio ??= 'Informe o município.';
    }

    if (Object.keys(erros).length > 0) return { ok: false, erros };
    return { ok: true, dados: { ...d, municipio: d.uf && d.municipio ? acharMunicipio(d.uf, d.municipio) : d.municipio } };
}

const PENDENCIA: Partial<Record<keyof LeadGrccDados, string>> = {
    uf: 'Sem UF',
    municipio: 'Sem município',
    valor: 'Sem valor',
    previsaoFechamento: 'Sem previsão',
    inicioFaturamento: 'Sem início do faturamento',
    motivoPerda: 'Sem motivo da perda',
};

/** Campos que faltam para o lead "contar certo" nos números. */
export function camposPendentes(l: LeadGrccDados): (keyof LeadGrccDados)[] {
    const c: (keyof LeadGrccDados)[] = [];
    if (!l.uf) c.push('uf');
    if (!l.municipio) c.push('municipio');
    if (!l.valor) c.push('valor');
    if (l.categoria !== 'Perda' && !l.previsaoFechamento) c.push('previsaoFechamento');
    if (l.categoria === 'Contratado' && !l.inicioFaturamento) c.push('inicioFaturamento');
    if (l.categoria === 'Perda' && !l.motivoPerda) c.push('motivoPerda');
    return c;
}

/** Rótulos do que falta (filtro ⚠ Pendências). */
export function pendenciasDoLead(l: LeadGrccDados): string[] {
    return camposPendentes(l).map((c) => PENDENCIA[c]!);
}
