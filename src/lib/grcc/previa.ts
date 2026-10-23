import { diffLead } from './diff';
import { chaveLead } from './normalizar';
import { CAMPOS_LEAD, type LeadGrcc, type LeadGrccDados, type LinhaPlanilha, type Previa, type ProblemaLinha } from './tipos';

export function dadosDoLead(l: LeadGrcc): LeadGrccDados {
    return Object.fromEntries(CAMPOS_LEAD.map((c) => [c, l[c]])) as unknown as LeadGrccDados;
}

/**
 * Planilha × banco. Import nunca exclui: leads que não estão na planilha simplesmente não
 * aparecem aqui. Usado no navegador (prévia) e de novo no servidor (confirmação).
 */
export function montarPrevia(linhas: LinhaPlanilha[], problemas: ProblemaLinha[], existentes: LeadGrcc[]): Previa {
    const porChave = new Map(existentes.map((l) => [chaveLead(l.cliente, l.solicitacao), l]));
    const previa: Previa = { novos: [], alterados: [], iguais: 0, problemas };

    for (const l of linhas) {
        const atual = porChave.get(chaveLead(l.dados.cliente, l.dados.solicitacao));
        if (!atual) {
            previa.novos.push(l);
            continue;
        }
        const mudancas = diffLead(dadosDoLead(atual), l.dados);
        if (mudancas.length === 0) previa.iguais++;
        else previa.alterados.push({ linha: l.linha, leadId: atual.id, dados: l.dados, mudancas });
    }
    return previa;
}
