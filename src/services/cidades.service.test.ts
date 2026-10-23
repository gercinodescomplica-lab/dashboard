import { describe, it, expect, beforeAll } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO } from '@/lib/grcc/tipos';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const q = await import('@/db/queries');
const { fetchCidadesLeads } = await import('./cidades.service');

beforeAll(async () => {
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026, avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 });
    await q.salvarLeadGrcc(null, {
        ...LEAD_VAZIO, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'Perda', motivoPerda: 'Prazo',
        etapa: 'Encerrado — perdido', familiaDemanda: 'Consultoria', valor: 10, uf: 'SP', municipio: 'Indaiatuba',
        previsaoFechamento: '2026-11-10', contatoNome: 'Graziela',
    });
    const { lead } = await q.salvarLeadGrcc(null, { ...LEAD_VAZIO, cliente: 'Excluído', valor: 1 });
    await q.excluirLeadGrcc(lead.id);
});

describe('fetchCidadesLeads (banco)', () => {
    it('devolve LeadCidade com os campos *_padrao preenchidos e sem excluídos', async () => {
        const leads = await fetchCidadesLeads();
        expect(leads).toHaveLength(1);
        expect(leads[0]).toMatchObject({
            cliente: 'Prefeitura de Indaiatuba',
            solicitacao: 'Consultoria',
            categoria: 'Perda',
            valor: 10,
            uf: 'SP',
            municipio: 'Indaiatuba',
            previsao_fechamento: '2026-11-10',
            contato_nome: 'Graziela',
            categoria_padrao: 'Perda',
            etapa_padrao: 'Encerrado — perdido',
            situacao_padrao: 'Perdido',
            motivo_padrao: 'Prazo',
            familia_demanda: 'Consultoria',
            solicitacao_padrao: 'Consultoria',
        });
    });
});
