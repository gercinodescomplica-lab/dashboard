// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const historicoDoLead = vi.fn();
vi.mock('@/services/grcc.service', () => ({ historicoDoLead: (...a: unknown[]) => historicoDoLead(...a) }));
const { LeadDetalheLeitura } = await import('./LeadDetalheLeitura');

const lead = { id: 9, cliente: 'ALESP', solicitacao: 'Chatbot', status: 'Proposta', categoria: 'No cliente', valor: 10, uf: 'SP', municipio: 'São Paulo', contato_nome: 'Fabio' };

describe('LeadDetalheLeitura', () => {
    it('mostra dados e linha do tempo, sem botões de edição', async () => {
        historicoDoLead.mockResolvedValue([
            { id: 1, leadId: 9, quando: '2026-10-20T10:00:00Z', origem: 'edicao', arquivo: null, autor: 'GRCC', mudancas: [{ campo: 'categoria', de: 'Validação', para: 'No cliente' }] },
        ]);
        render(<LeadDetalheLeitura claro={false} onFechar={() => {}} lead={lead} />);
        expect(screen.getByText('ALESP')).toBeInTheDocument();
        expect(screen.getByText('Fabio')).toBeInTheDocument();
        expect(await screen.findByText('No cliente', { selector: 'span' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Salvar|Excluir/ })).not.toBeInTheDocument();
    });

    it('mostra mensagem em pt-BR quando o histórico falha', async () => {
        historicoDoLead.mockRejectedValue(new Error('x'));
        render(<LeadDetalheLeitura claro={false} onFechar={() => {}} lead={lead} />);
        expect(await screen.findByText('Não foi possível carregar o histórico.')).toBeInTheDocument();
    });

    it('ignora resposta atrasada do lead A depois de trocar para o B', async () => {
        let resolverA: (v: unknown[]) => void = () => {};
        historicoDoLead.mockImplementation((id: number) =>
            id === 9
                ? new Promise((r) => (resolverA = r))
                : Promise.resolve([{ id: 2, leadId: 10, quando: '2026-10-20T10:00:00Z', origem: 'edicao', arquivo: null, autor: 'GRCC', mudancas: [{ campo: 'categoria', de: 'X', para: 'Do B' }] }])
        );
        const { rerender } = render(<LeadDetalheLeitura claro={false} onFechar={() => {}} lead={lead} />);
        rerender(<LeadDetalheLeitura claro={false} onFechar={() => {}} lead={{ ...lead, id: 10, cliente: 'OUTRO' }} />);
        expect(await screen.findByText('Do B', { selector: 'span' })).toBeInTheDocument();
        resolverA([{ id: 1, leadId: 9, quando: '2026-10-20T10:00:00Z', origem: 'edicao', arquivo: null, autor: 'GRCC', mudancas: [{ campo: 'categoria', de: 'Y', para: 'Do A' }] }]);
        await Promise.resolve();
        expect(screen.queryByText('Do A', { selector: 'span' })).not.toBeInTheDocument();
        expect(screen.getByText('Do B', { selector: 'span' })).toBeInTheDocument();
    });
});
