import { z } from 'zod';
import { CATEGORIAS_GRCC, type LeadGrccDados } from './tipos';
import { acharMunicipio } from './municipios';

const textoOpcional = z.string().trim().transform((s) => (s === '' ? null : s)).nullable();
const dataOpcional = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .nullable()
    .or(z.literal('').transform(() => null));

export const schemaLead = z.object({
    cliente: z.string().trim().min(1, 'Informe o cliente.'),
    solicitacao: z.string().trim(),
    status: textoOpcional,
    categoria: z.enum(CATEGORIAS_GRCC, { message: 'Categoria inválida.' }),
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

export function validarLead(
    entrada: unknown,
    opts: { exigirLocal?: boolean } = {}
): { ok: true; dados: LeadGrccDados } | { ok: false; erros: Erros } {
    const r = schemaLead.safeParse(entrada);
    const erros: Erros = {};
    if (!r.success) {
        for (const issue of r.error.issues) {
            const campo = issue.path[0] as keyof LeadGrccDados;
            erros[campo] ??= issue.message;
        }
        return { ok: false, erros };
    }
    const d = r.data as LeadGrccDados;

    if (d.categoria === 'Perda' && !d.motivoPerda) erros.motivoPerda = 'Informe o motivo da perda.';
    if (d.categoria === 'Contratado' && !d.inicioFaturamento) erros.inicioFaturamento = 'Informe o início do faturamento.';
    if (d.uf && d.municipio && !acharMunicipio(d.uf, d.municipio)) erros.municipio = `Município não encontrado em ${d.uf}.`;
    if (opts.exigirLocal) {
        if (!d.solicitacao) erros.solicitacao = 'Informe a solicitação.';
        if (!d.uf) erros.uf = 'Informe a UF.';
        if (!d.municipio) erros.municipio ??= 'Informe o município.';
    }

    if (Object.keys(erros).length > 0) return { ok: false, erros };
    return { ok: true, dados: { ...d, municipio: d.uf && d.municipio ? acharMunicipio(d.uf, d.municipio) : d.municipio } };
}

/** O que falta para o lead "contar certo" nos números (filtro ⚠ Pendências). */
export function pendenciasDoLead(l: LeadGrccDados): string[] {
    const p: string[] = [];
    if (!l.uf) p.push('Sem UF');
    if (!l.municipio) p.push('Sem município');
    if (!l.valor) p.push('Sem valor');
    if (l.categoria !== 'Perda' && !l.previsaoFechamento) p.push('Sem previsão');
    if (l.categoria === 'Contratado' && !l.inicioFaturamento) p.push('Sem início do faturamento');
    return p;
}
