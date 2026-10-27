// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LEAD_VAZIO, type LeadGrcc } from '@/lib/grcc/tipos';

const salvarLead = vi.fn();
const excluirLead = vi.fn();
const historicoDoLead = vi.fn();
vi.mock('../actions', () => ({ salvarLead: (...a: unknown[]) => salvarLead(...a), excluirLead: (...a: unknown[]) => excluirLead(...a) }));
vi.mock('@/services/grcc.service', () => ({ historicoDoLead: (...a: unknown[]) => historicoDoLead(...a) }));
vi.mock('../KeyGateGrcc', () => ({ useChaveGrcc: () => ({ chave: 'k', sair: () => {} }) }));

const { LeadPainel } = await import('./LeadPainel');

const listas = { categoria: ['Novo', 'Validação', 'Parceiro', 'Em tratativas', 'No cliente', 'Contratado', 'Perda'], etapa: [], situacao: [], motivoPerda: ['Prazo'], familiaDemanda: [] };
const lead: LeadGrcc = {
    ...LEAD_VAZIO, visivelDashboard: true, id: 5, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'No cliente',
    uf: 'SP', municipio: 'Indaiatuba', valor: 10, previsaoFechamento: '2026-11-10', criadoEm: 'x', atualizadoEm: '2026-10-20T00:00:00Z',
};

beforeEach(() => {
    salvarLead.mockReset();
    excluirLead.mockReset();
    historicoDoLead.mockReset().mockResolvedValue([]);
});

describe('LeadPainel', () => {
    describe('andamento', () => {
        const comAndamento = { ...lead, status: 'Proposta no cliente 17/08' };

        it('registrar andamento grava o texto novo como andamento atual', async () => {
            const user = userEvent.setup();
            salvarLead.mockResolvedValue({ ok: true, valor: comAndamento });
            render(<LeadPainel aberto lead={comAndamento} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
            await user.type(screen.getByLabelText('Registrar andamento'), 'Reunião com o secretário em 02/11');
            await user.click(screen.getByRole('button', { name: 'Salvar' }));
            await waitFor(() =>
                expect(salvarLead).toHaveBeenCalledWith('k', 5, expect.objectContaining({ status: 'Reunião com o secretário em 02/11' }), { visivelDashboard: true })
            );
        });

        it('salvar sem registrar andamento mantém o andamento atual', async () => {
            const user = userEvent.setup();
            salvarLead.mockResolvedValue({ ok: true, valor: comAndamento });
            render(<LeadPainel aberto lead={comAndamento} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
            await user.click(screen.getByRole('button', { name: 'Salvar' }));
            await waitFor(() =>
                expect(salvarLead).toHaveBeenCalledWith('k', 5, expect.objectContaining({ status: 'Proposta no cliente 17/08' }), { visivelDashboard: true })
            );
        });

        it('mostra os andamentos anteriores gravados no histórico', async () => {
            historicoDoLead.mockResolvedValue([
                { id: 1, leadId: 5, quando: '2026-08-17T10:00:00Z', origem: 'importacao', arquivo: 'x.xlsx', autor: 'GRCC', mudancas: [{ campo: 'status', de: null, para: 'Proposta no cliente 17/08' }] },
                { id: 2, leadId: 5, quando: '2026-09-02T10:00:00Z', origem: 'edicao', arquivo: null, autor: 'GRCC', mudancas: [{ campo: 'status', de: 'Proposta no cliente 17/08', para: 'Reunião 02/09' }] },
            ]);
            render(<LeadPainel aberto lead={comAndamento} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
            const itens = await screen.findAllByRole('listitem');
            expect(itens.map((i) => i.textContent)).toEqual([expect.stringContaining('Reunião 02/09'), expect.stringContaining('Proposta no cliente 17/08')]);
        });
    });

    describe('com o relógio fixado', () => {
        // O trimestre depende do ano corrente: sem fixar a data, este teste quebraria em 2027.
        afterEach(() => vi.useRealTimers());

        it('mostra onde o lead cai no pipeline da Débora', () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-10-23T12:00:00'));
            render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
            expect(screen.getByText(/Entra no pipeline da Débora/)).toHaveTextContent('Entra no pipeline da Débora como quente em Q4');
        });

        it('em outro ano a mesma previsão não está mapeada', () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2027-03-01T12:00:00'));
            render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
            expect(screen.getByText(/Entra no pipeline da Débora/)).toHaveTextContent('como quente em não mapeado');
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

    describe('modo completar cadastro', () => {
        const props = () => ({
            aberto: true,
            lead: { ...lead, municipio: null },
            listas,
            onFechar: vi.fn(),
            onGravado: async () => {},
            onProximo: vi.fn(),
            faixa: 'Completando cadastro · faltam 3',
        });

        it('"Salvar e próximo" vai para o próximo em vez de fechar', async () => {
            const user = userEvent.setup();
            salvarLead.mockResolvedValue({ ok: true, valor: lead });
            const p = props();
            render(<LeadPainel {...p} />);
            expect(screen.getByText('Completando cadastro · faltam 3')).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Salvar e próximo' }));
            await waitFor(() => expect(p.onProximo).toHaveBeenCalled());
            expect(p.onFechar).not.toHaveBeenCalled();
        });

        it('"Pular" vai para o próximo sem salvar', async () => {
            const user = userEvent.setup();
            const p = props();
            render(<LeadPainel {...p} />);
            await user.click(screen.getByRole('button', { name: 'Pular' }));
            expect(p.onProximo).toHaveBeenCalled();
            expect(salvarLead).not.toHaveBeenCalled();
        });
    });

    it('destaca o campo que falta e o aviso some ao preencher', async () => {
        const user = userEvent.setup();
        render(<LeadPainel aberto lead={{ ...lead, valor: 0 }} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
        expect(screen.getByText(/Falta 1 campo/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Valor' })).toBeInTheDocument();
        expect(screen.getByText('Falta preencher para contar certo no pipeline.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('Valor (R$)'), '1.000,00');
        expect(screen.queryByText(/Falta 1 campo/)).not.toBeInTheDocument();
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
        expect(salvarLead).toHaveBeenCalledWith('k', 5, expect.objectContaining({ categoria: 'Perda' }), { visivelDashboard: true });
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
