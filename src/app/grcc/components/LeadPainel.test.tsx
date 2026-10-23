// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LEAD_VAZIO, type LeadGrcc } from '@/lib/grcc/tipos';

const salvarLead = vi.fn();
const excluirLead = vi.fn();
vi.mock('../actions', () => ({ salvarLead: (...a: unknown[]) => salvarLead(...a), excluirLead: (...a: unknown[]) => excluirLead(...a) }));
vi.mock('@/services/grcc.service', () => ({ historicoDoLead: vi.fn().mockResolvedValue([]) }));
vi.mock('../KeyGateGrcc', () => ({ useChaveGrcc: () => ({ chave: 'k', sair: () => {} }) }));

const { LeadPainel } = await import('./LeadPainel');

const listas = { categoria: ['Novo', 'Validação', 'Parceiro', 'Em tratativas', 'No cliente', 'Contratado', 'Perda'], etapa: [], situacao: [], motivoPerda: ['Prazo'], familiaDemanda: [] };
const lead: LeadGrcc = {
    ...LEAD_VAZIO, id: 5, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'No cliente',
    uf: 'SP', municipio: 'Indaiatuba', valor: 10, previsaoFechamento: '2026-11-10', criadoEm: 'x', atualizadoEm: '2026-10-20T00:00:00Z',
};

beforeEach(() => {
    salvarLead.mockReset();
    excluirLead.mockReset();
});

describe('LeadPainel', () => {
    it('mostra onde o lead cai no pipeline da Débora', () => {
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
        expect(screen.getByText(/No pipeline da Débora: Q4 · quente/)).toBeInTheDocument();
    });

    it('motivo da perda só aparece em Perda e os erros do servidor aparecem no campo', async () => {
        const user = userEvent.setup();
        salvarLead.mockResolvedValue({ ok: false, erro: 'Corrija os campos destacados.', erros: { motivoPerda: 'Informe o motivo da perda.' } });
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
        expect(screen.queryByLabelText(/Motivo da perda/)).not.toBeInTheDocument();
        await user.selectOptions(screen.getByLabelText('Categoria'), 'Perda');
        expect(screen.getByLabelText(/Motivo da perda/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('Informe o motivo da perda.')).toBeInTheDocument();
        expect(salvarLead).toHaveBeenCalledWith('k', 5, expect.objectContaining({ categoria: 'Perda' }));
    });

    it('excluir pede confirmação inline antes de chamar a action', async () => {
        const user = userEvent.setup();
        excluirLead.mockResolvedValue({ ok: true, valor: null });
        const onGravado = vi.fn().mockResolvedValue(undefined);
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={onGravado} />);
        await user.click(screen.getByRole('button', { name: 'Excluir' }));
        expect(excluirLead).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Sim, excluir' }));
        await waitFor(() => expect(excluirLead).toHaveBeenCalledWith('k', 5));
        expect(onGravado).toHaveBeenCalledWith('Lead excluído.');
    });
});
