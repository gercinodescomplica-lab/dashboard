// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const linhaDoTempoComercial = vi.fn();
vi.mock('@/services/grcc.service', () => ({ linhaDoTempoComercial: (...a: unknown[]) => linhaDoTempoComercial(...a) }));
const { LeadDetalheLeitura } = await import('./LeadDetalheLeitura');

const lead = { id: 9, cliente: 'ALESP', solicitacao: 'Chatbot', status: 'Proposta enviada', categoria: 'No cliente', valor: 0, uf: 'SP', municipio: 'São Paulo', contato_nome: 'Fabio' };

describe('LeadDetalheLeitura', () => {
    it('mostra estado atual, "Valor a definir" e a linha do tempo comercial, sem edição', async () => {
        linhaDoTempoComercial.mockResolvedValue([
            { id: 2, quando: '2026-10-20T10:00:00Z', inicio: false, mudancas: [{ campo: 'categoria', de: 'Em tratativas', para: 'No cliente' }] },
            { id: 1, quando: '2026-10-01T10:00:00Z', inicio: true, mudancas: [] },
        ]);
        render(<LeadDetalheLeitura claro={false} onFechar={() => {}} lead={lead} />);
        expect(screen.getByText('ALESP')).toBeInTheDocument();
        expect(screen.getByText('Fabio')).toBeInTheDocument();
        expect(screen.getByText('A definir')).toBeInTheDocument();
        expect(await screen.findByText('Em tratativas')).toBeInTheDocument();
        expect(screen.getByText('Entrou no cadastro da GRCC')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Salvar|Excluir/ })).not.toBeInTheDocument();
    });

    it('mostra mensagem em pt-BR quando a linha do tempo falha', async () => {
        linhaDoTempoComercial.mockRejectedValue(new Error('x'));
        render(<LeadDetalheLeitura claro={false} onFechar={() => {}} lead={lead} />);
        expect(await screen.findByText('Não foi possível carregar a linha do tempo.')).toBeInTheDocument();
    });
});
