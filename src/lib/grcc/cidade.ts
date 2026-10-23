import type { LeadCidade } from '@/types/cidades';
import type { LeadGrcc } from './tipos';

/** Lead do banco → formato que a aba Cidades (CidadesView/BrazilHeatMap) já consome. */
export function leadParaCidade(l: LeadGrcc): LeadCidade {
    const situacao = l.situacao ?? (l.categoria === 'Perda' ? 'Perdido' : undefined);
    return {
        id: l.id,
        cliente: l.cliente,
        solicitacao: l.solicitacao,
        status: l.status ?? '',
        categoria: l.categoria,
        valor: l.valor,
        uf: l.uf ?? '',
        municipio: l.municipio ?? '',
        regiao: l.regiao ?? undefined,
        contato_nome: l.contatoNome ?? undefined,
        contato_email: l.contatoEmail ?? undefined,
        contato_telefone: l.contatoTelefone ?? undefined,
        previsao_fechamento: l.previsaoFechamento ?? undefined,
        categoria_padrao: l.categoria,
        etapa_padrao: l.etapa ?? undefined,
        situacao_padrao: situacao,
        motivo_padrao: l.motivoPerda ?? undefined,
        familia_demanda: l.familiaDemanda ?? undefined,
        solicitacao_padrao: l.solicitacao || undefined,
    };
}
