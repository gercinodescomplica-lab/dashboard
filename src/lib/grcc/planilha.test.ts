import { describe, it, expect } from 'vitest';
import { lerLinhasPlanilha } from './planilha';
import { validarLead } from './validacao';

const CAB = [
    'Cliente', 'Solicitação', 'Status', 'Categoria', 'Valor', 'UF', 'Município', 'Região',
    'Contato Nome', 'Contato Email', 'Contato Telefone', 'Previsão de fechamento',
    'Etapa Padrão', 'Situação Padrão', 'Motivo Padrão', 'Família Demanda',
];

function linha(over: Partial<Record<string, unknown>> = {}): unknown[] {
    const base: Record<string, unknown> = {
        Cliente: 'Prefeitura de Indaiatuba',
        'Solicitação': 'Consultoria',
        Status: 'Proposta no cliente 12/06',
        Categoria: 'No cliente',
        Valor: 'R$ 260.758,68',
        UF: 'SP',
        'Município': '#VALUE!',
        'Região': 'Sudeste',
        'Contato Nome': 'Graziela',
        'Contato Email': 'g@indaiatuba.sp.gov.br',
        'Contato Telefone': '(19) 0000-0000',
        'Previsão de fechamento': 46336,
        'Etapa Padrão': 'Proposta no cliente',
        'Situação Padrão': 'Em andamento',
        'Motivo Padrão': null,
        'Família Demanda': 'Consultoria',
        ...over,
    };
    return CAB.map((c) => base[c] ?? null);
}

describe('lerLinhasPlanilha', () => {
    it('mapeia por nome de cabeçalho, sem depender da ordem', () => {
        const cabInvertido = [...CAB].reverse();
        const l = linha();
        const r = lerLinhasPlanilha([cabInvertido, [...l].reverse()]);
        expect(r.colunasFaltando).toEqual([]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas).toHaveLength(1);
        expect(r.linhas[0]).toEqual({
            linha: 2,
            dados: expect.objectContaining({
                cliente: 'Prefeitura de Indaiatuba',
                solicitacao: 'Consultoria',
                categoria: 'No cliente',
                valor: 260758.68,
                uf: 'SP',
                municipio: 'Indaiatuba', // #VALUE! → deduzido do cliente → grafia oficial
                previsaoFechamento: '2026-11-10',
                etapa: 'Proposta no cliente',
                situacao: 'Em andamento',
                familiaDemanda: 'Consultoria',
                motivoPerda: null,
                duracaoMeses: 12,
            }),
        });
    });

    it('aceita os nomes que o Power Automate usava (categoria_padrao etc.)', () => {
        const cab = ['cliente', 'solicitacao', 'valor', 'uf', 'categoria_padrao', 'motivo_padrao'];
        const r = lerLinhasPlanilha([cab, ['X de Y', 's', '10', 'SP', 'Perda', 'Prazo']]);
        expect(r.linhas[0].dados.categoria).toBe('Perda');
        expect(r.linhas[0].dados.motivoPerda).toBe('Prazo');
    });

    it('mapeia cada campo do fluxo Power Automate (cidades.service.ts) para o seu campo', () => {
        // Cabeçalho = exatamente as chaves que o fluxo devolvia. Valores distintos por coluna
        // para que um alias trocado de campo apareça como falha.
        const cab = [
            'cliente', 'solicitacao', 'solicitacao_padrao', 'status', 'categoria', 'categoria_padrao',
            'etapa_padrao', 'situacao_padrao', 'motivo_padrao', 'familia_demanda', 'valor', 'uf',
            'municipio', 'regiao', 'contato_nome', 'contato_email', 'contato_telefone', 'previsao_fechamento',
        ];
        const row = [
            'Prefeitura de Indaiatuba', 'Solicitacao A', 'Solicitacao P', 'Status X', 'Novo', 'Perda',
            'Etapa Y', 'Situacao Z', 'Motivo W', 'Familia V', '1.234,56', 'SP',
            'Indaiatuba', 'Sudeste', 'Graziela', 'g@indaiatuba.sp.gov.br', '(19) 0000-0000', 46336,
        ];
        const r = lerLinhasPlanilha([cab, row]);
        expect(r.colunasFaltando).toEqual([]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas[0].dados).toEqual({
            cliente: 'Prefeitura de Indaiatuba',
            solicitacao: 'Solicitacao A', // 'solicitacao' tem prioridade sobre 'solicitacao_padrao'
            status: 'Status X',
            categoria: 'Perda', // 'categoria_padrao' tem prioridade sobre 'categoria'
            temperatura: null, // o fluxo não traz temperatura: fica automática
            etapa: 'Etapa Y',
            situacao: 'Situacao Z',
            motivoPerda: 'Motivo W',
            familiaDemanda: 'Familia V',
            valor: 1234.56,
            uf: 'SP',
            municipio: 'Indaiatuba',
            regiao: 'Sudeste',
            contatoNome: 'Graziela',
            contatoEmail: 'g@indaiatuba.sp.gov.br',
            contatoTelefone: '(19) 0000-0000',
            previsaoFechamento: '2026-11-10',
            inicioFaturamento: null,
            duracaoMeses: 12,
        });
    });

    it('prefere "categoria padrão" a "categoria" quando as duas existem', () => {
        const cab = ['cliente', 'valor', 'uf', 'categoria', 'categoria padrao'];
        const r = lerLinhasPlanilha([cab, ['A', '1', 'SP', 'Em trataivas', 'Parceiro']]);
        expect(r.linhas[0].dados.categoria).toBe('Parceiro');
    });

    it('lista colunas obrigatórias ausentes e não lê nada', () => {
        const r = lerLinhasPlanilha([['cliente', 'status'], ['A', 'x']]);
        expect(r.colunasFaltando).toEqual(['Valor', 'UF']);
        expect(r.linhas).toEqual([]);
    });

    it('pula linha vazia e linha-título "Propostas Perdidas" sem acusar problema', () => {
        const vazia = CAB.map(() => null);
        const titulo = CAB.map((c) => (c === 'Cliente' ? 'Propostas Perdidas' : null));
        const r = lerLinhasPlanilha([CAB, vazia, titulo, linha()]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas.map((l) => l.linha)).toEqual([4]);
    });

    it('acusa valor ilegível, UF inválida e cliente vazio', () => {
        const r = lerLinhasPlanilha([
            CAB,
            linha({ Valor: 'a definir' }),
            linha({ UF: 'XX' }),
            linha({ Cliente: '', 'Solicitação': 'algo' }),
        ]);
        expect(r.linhas).toEqual([]);
        expect(r.problemas).toEqual([
            { linha: 2, cliente: 'Prefeitura de Indaiatuba', motivo: 'Valor ilegível: "a definir"' },
            { linha: 3, cliente: 'Prefeitura de Indaiatuba', motivo: 'UF inválida: "XX"' },
            { linha: 4, cliente: '', motivo: 'Cliente vazio' },
        ]);
    });

    it('município que não existe na UF fica vazio (vira pendência, não problema)', () => {
        const r = lerLinhasPlanilha([CAB, linha({ Cliente: 'ALESP', 'Município': '#VALUE!' })]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas[0].dados.municipio).toBeNull();
    });

    it('UF vazia é aceita (pendência)', () => {
        const r = lerLinhasPlanilha([CAB, linha({ UF: '' })]);
        expect(r.linhas[0].dados.uf).toBeNull();
        expect(r.linhas[0].dados.municipio).toBeNull();
    });

    it('acusa duplicadas (mesmo cliente+solicitação) nas duas linhas', () => {
        const r = lerLinhasPlanilha([CAB, linha(), linha({ Cliente: 'prefeitura  de indaiatuba' })]);
        expect(r.linhas).toEqual([]);
        expect(r.problemas.map((p) => [p.linha, p.motivo])).toEqual([
            [2, 'Duplicada (mesmo cliente e solicitação da linha 3)'],
            [3, 'Duplicada (mesmo cliente e solicitação da linha 2)'],
        ]);
    });

    it('contrato com o servidor: toda linha lida passa na validação de importação; o resto vai para "com problema"', () => {
        const CAB2 = [...CAB, 'Início do faturamento', 'Duração'];
        const com = (over: Partial<Record<string, unknown>>, extra: unknown[] = [null, null]) => [...linha(over), ...extra];
        const r = lerLinhasPlanilha([
            CAB2,
            com({ Cliente: 'Prefeitura de Santos', Categoria: 'Contratado' }),
            com({ Cliente: 'Prefeitura de Campinas', Categoria: 'Perda' }),
            com({ Cliente: 'Prefeitura de Sorocaba', 'Contato Email': 'n/a' }),
            com({ Cliente: 'Prefeitura de Osasco' }),
            com({ Cliente: 'Prefeitura de Jundiaí' }, [null, 999]),
        ]);
        expect(r.linhas.map((l) => l.dados.cliente)).toEqual([
            'Prefeitura de Santos', 'Prefeitura de Campinas', 'Prefeitura de Sorocaba', 'Prefeitura de Osasco',
        ]);
        for (const l of r.linhas) expect(validarLead(l.dados, { modo: 'importacao' })).toEqual({ ok: true, dados: l.dados });
        expect(r.linhas[2].dados.contatoEmail).toBeNull();
        expect(r.problemas).toHaveLength(1);
        expect(r.problemas[0]).toMatchObject({ linha: 6, cliente: 'Prefeitura de Jundiaí' });
        expect(r.problemas[0].motivo).not.toBe('');
    });

    it('data impossível na planilha vira vazia (pendência) em vez de derrubar a importação', () => {
        const r = lerLinhasPlanilha([CAB, linha({ 'Previsão de fechamento': '31/02/2026' })]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas[0].dados.previsaoFechamento).toBeNull();
    });
});
