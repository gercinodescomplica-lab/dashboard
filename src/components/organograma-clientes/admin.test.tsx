// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { montarOrganograma } from '@/lib/carteira/organograma-clientes';

const a = vi.hoisted(() => ({
    carregarPainelCarteiraAction: vi.fn(), moverClienteNoOrganogramaAction: vi.fn(), alterarCarteiraAction: vi.fn(), criarGerenciaAction: vi.fn(),
    editarGerenciaAction: vi.fn(), definirGerenciaVisivelAction: vi.fn(), definirClienteAtivoAction: vi.fn(), alinharClienteAction: vi.fn(),
    ligarClienteAction: vi.fn(), criarClienteAction: vi.fn(), criarELigarClienteAction: vi.fn(), juntarClientesAction: vi.fn(),
}));
vi.mock('@/app/settings/carteiraActions', () => a);
vi.mock('@/app/settings/chaveLocal', () => ({ lerChaveSettings: () => 'adm' }));

import { OrganogramaClientesAdmin } from './admin';

const painel = {
    organograma: montarOrganograma([{ id: 'GRC3', nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'], clientes: [{ id: 'c-smt', nome: 'Transportes', sigla: 'SMT', ultimoMovimento: null }] }], []),
    gerencias: [{ chave: 'GRC3', cardId: 'grc3-barone', nome: 'Barone', visivel: true, clientes: [{ id: 'c-smt', nome: 'Transportes', sigla: 'SMT', ativo: true }] }],
    semCarteira: [{ id: 'c-smc', nome: 'Cultura', sigla: 'SMC' }],
    todosClientes: [],
    fora: [{ clienteId: 'c-seme', sigla: 'SEME', nome: 'Esportes', carteira: 'GRC1', gerenciasDosDados: ['GRC4'] }],
    semCliente: [{ tabela: 'contrato', id: 'ct-x', texto: 'ALESP', gerencia: 'GRC4' }],
};

beforeEach(() => {
    a.carregarPainelCarteiraAction.mockResolvedValue({ ok: true, valor: painel });
    for (const f of Object.values(a)) if (f !== a.carregarPainelCarteiraAction) f.mockResolvedValue({ ok: true, valor: null });
});

describe('OrganogramaClientesAdmin', () => {
    it('Editar: põe cliente sem carteira com a chave e recarrega', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        const cartao = await screen.findByRole('region', { name: 'Gerência GRC3' });
        await user.click(within(cartao).getByRole('combobox', { name: 'Adicionar cliente sem carteira' }));
        await user.click(await within(cartao).findByRole('option', { name: 'SMC · Cultura' }));
        expect(a.alterarCarteiraAction).toHaveBeenCalledWith('adm', 'GRC3', { adicionar: ['c-smc'], remover: [] });
        expect(a.carregarPainelCarteiraAction).toHaveBeenCalledTimes(2);
    });
    it('A conferir: trazer dados para a carteira', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        await user.click(await screen.findByRole('tab', { name: 'A conferir' }));
        await user.click(screen.getByRole('button', { name: 'Trazer os dados de SEME para a carteira' }));
        await user.click(screen.getByRole('button', { name: 'Trazer' }));
        expect(a.alinharClienteAction).toHaveBeenCalledWith('adm', 'c-seme');
        expect(screen.getByText('ALESP')).toBeInTheDocument();
    });
    it('A conferir: juntar clientes pede confirmação e chama a action; mesmo cliente nos dois desabilita', async () => {
        a.carregarPainelCarteiraAction.mockResolvedValue({ ok: true, valor: { ...painel, todosClientes: [
            { id: 'c-a', nome: 'Educação', sigla: 'SME', gerencia: 'GRC3', ativo: true }, { id: 'c-b', nome: 'Secretaria de Educação', sigla: null, gerencia: null, ativo: true },
        ] } });
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        await user.click(await screen.findByRole('tab', { name: 'A conferir' }));
        const secao = screen.getByRole('region', { name: 'Juntar clientes' });
        const juntar = within(secao).getByRole('button', { name: 'Juntar' });
        await user.click(within(secao).getByRole('combobox', { name: 'Cliente que some' }));
        await user.click(await within(secao).findByRole('option', { name: 'SME · Educação (GRC3)' }));
        await user.click(within(secao).getByRole('combobox', { name: 'Cliente que fica' }));
        await user.click(await within(secao).findByRole('option', { name: 'SME · Educação (GRC3)' }));
        expect(juntar).toBeDisabled();
        await user.clear(within(secao).getByRole('combobox', { name: 'Cliente que fica' }));
        await user.click(await within(secao).findByRole('option', { name: 'Secretaria de Educação' }));
        await user.click(juntar);
        // Duas siglas iguais não confundem: o diálogo mostra o rótulo completo de quem some e de quem fica.
        expect(screen.getByText(/^Tudo de SME · Educação \(GRC3\) passa para Secretaria de Educação e SME · Educação \(GRC3\) é apagado\./)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Juntar clientes' }));
        expect(a.juntarClientesAction).toHaveBeenCalledWith('adm', 'c-a', 'c-b');
    });
    it('Ocultar gerência com erro mostra a mensagem', async () => {
        a.definirGerenciaVisivelAction.mockResolvedValue({ ok: false, erro: 'Tire os 1 clientes da carteira antes de desativar.' });
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        const cartao = await screen.findByRole('region', { name: 'Gerência GRC3' });
        await user.click(within(cartao).getByRole('button', { name: 'Ocultar' }));
        await user.click(screen.getByRole('button', { name: 'Ocultar gerência' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Tire os 1 clientes');
    });
    it('ação que lança mostra erro e recarrega', async () => {
        a.definirGerenciaVisivelAction.mockRejectedValue(new Error('500'));
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        const cartao = await screen.findByRole('region', { name: 'Gerência GRC3' });
        await user.click(within(cartao).getByRole('button', { name: 'Ocultar' }));
        await user.click(screen.getByRole('button', { name: 'Ocultar gerência' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível gravar. Tente de novo.');
        expect(a.carregarPainelCarteiraAction).toHaveBeenCalledTimes(2);
    });
    it('Criar cliente e ligar chama a ação única', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        await user.click(await screen.findByRole('tab', { name: 'A conferir' }));
        await user.click(screen.getByRole('button', { name: 'Criar cliente "ALESP" e ligar' }));
        expect(a.criarELigarClienteAction).toHaveBeenCalledTimes(1);
        expect(a.criarELigarClienteAction).toHaveBeenCalledWith('adm', 'contrato', 'ct-x', { nome: 'ALESP', sigla: null });
        expect(a.criarClienteAction).not.toHaveBeenCalled();
    });
    it('recarga que falha mostra erro e libera os botões', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        const cartao = await screen.findByRole('region', { name: 'Gerência GRC3' });
        a.carregarPainelCarteiraAction.mockRejectedValueOnce(new Error('500'));
        await user.click(within(cartao).getByRole('button', { name: 'Ocultar' }));
        await user.click(screen.getByRole('button', { name: 'Ocultar gerência' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o organograma de clientes.');
        expect(within(screen.getByRole('region', { name: 'Gerência GRC3' })).getByRole('button', { name: 'Ocultar' })).toBeEnabled();
    });
});
