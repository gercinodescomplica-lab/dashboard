// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    describe('com o relógio fixado', () => {
        // O trimestre depende do ano corrente: sem fixar a data, este teste quebraria em 2027.
        afterEach(() => vi.useRealTimers());

        it('mostra onde o lead cai no pipeline da Débora', () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-10-23T12:00:00'));
            render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
            expect(screen.getByText(/No pipeline da Débora: Q4 · quente/)).toBeInTheDocument();
        });

        it('em outro ano a mesma previsão não está mapeada', () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2027-03-01T12:00:00'));
            render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
            expect(screen.getByText(/No pipeline da Débora: não mapeado/)).toBeInTheDocument();
        });
    });

    it('salvou mas a recarga da tela falhou: fecha sem dizer que não salvou', async () => {
        const user = userEvent.setup();
        salvarLead.mockResolvedValue({ ok: true, valor: lead });
        const onGravado = vi.fn().mockRejectedValue(new Error('recarga'));
        const onFechar = vi.fn();
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={onFechar} onGravado={onGravado} />);
        await user.click(screen.getByRole('button', { name: 'Salvar' }));
        await waitFor(() => expect(onFechar).toHaveBeenCalled());
        expect(onGravado).toHaveBeenCalledWith('Lead atualizado.');
        expect(screen.queryByText(/Não foi possível salvar agora/)).not.toBeInTheDocument();
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

    it('novo objeto do mesmo lead não apaga o que foi digitado; outro id reinicia', async () => {
        const user = userEvent.setup();
        const props = { aberto: true, listas, onFechar: () => {}, onGravado: async () => {} };
        const { rerender } = render(<LeadPainel {...props} lead={lead} />);
        const campo = screen.getByLabelText(/^Cliente/);
        await user.clear(campo);
        await user.type(campo, 'Digitado');
        rerender(<LeadPainel {...props} lead={{ ...lead, atualizadoEm: '2026-10-21T00:00:00Z' }} />);
        expect(screen.getByLabelText(/^Cliente/)).toHaveValue('Digitado');
        rerender(<LeadPainel {...props} lead={{ ...lead, id: 6, cliente: 'Outro' }} />);
        expect(screen.getByLabelText(/^Cliente/)).toHaveValue('Outro');
    });

    it('salvarLead que rejeita reabilita Salvar e mostra erro', async () => {
        const user = userEvent.setup();
        salvarLead.mockRejectedValue(new Error('rede'));
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
        await user.click(screen.getByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText(/Não foi possível salvar agora/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    });
});
