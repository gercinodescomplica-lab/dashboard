// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganogramaClientesView } from './quadro';
import { montarOrganograma, type GerenciaDoOrganograma } from '@/lib/carteira/organograma-clientes';

const cli = (id: string, sigla: string, nome: string) => ({ id, sigla, nome, ultimoMovimento: null });
const gerencias: GerenciaDoOrganograma[] = [
    { id: 'KAM1', nome: 'KAM1', sigla: 'KAM1', ativa: true, gerentes: ['Malde'], clientes: [cli('c-sme', 'SME', 'Secretaria Municipal da Educação')] },
    { id: 'GRC3', nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'], clientes: [cli('c-smt', 'SMT', 'Secretaria Municipal de Transportes')] },
    { id: 'GRC4', nome: 'GRC4', sigla: 'GRC4', ativa: true, gerentes: ['Beatriz'], clientes: [] },
];
const dados = montarOrganograma(gerencias, [cli('c-smc', 'SMC', 'Secretaria Municipal de Cultura')]);
const cartao = (nome: RegExp) => screen.getByRole('region', { name: nome });
const mover = vi.fn();
const aoMudar = vi.fn();

beforeEach(() => mover.mockResolvedValue({ ok: true, valor: { movidos: 1 } }));

describe('OrganogramaClientesView', () => {
    it('cartões, clientes, total e legenda', () => {
        render(<OrganogramaClientesView dados={dados} podeMover={false} />);
        expect(within(cartao(/^Barone/)).getByText('SMT')).toBeInTheDocument();
        expect(screen.getByText('órgãos atendidos').parentElement).toHaveTextContent('2');
        expect(screen.getByText('KAM, contas-chave')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Sem carteira' })).toHaveTextContent('SMC');
    });
    it('busca sem acento no quadro todo', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesView dados={dados} podeMover={false} />);
        await user.type(screen.getByRole('searchbox', { name: 'Buscar cliente' }), 'educacao');
        expect(within(cartao(/^Malde/)).getByText('SME')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: /^Barone/ })).not.toBeInTheDocument();
        expect(screen.getByText('1 cliente(s) encontrado(s).')).toBeInTheDocument();
    });
    it('só leitura: sem menu nem arraste', () => {
        render(<OrganogramaClientesView dados={dados} podeMover={false} />);
        expect(screen.queryByRole('button', { name: /^Mover / })).not.toBeInTheDocument();
        expect(within(cartao(/^Barone/)).getByText('SMT').closest('li')).toHaveAttribute('draggable', 'false');
    });
    it('admin: menu → confirma → grava → Desfazer', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesView dados={dados} podeMover moverAction={mover} aoMudar={aoMudar} />);
        await user.click(screen.getByRole('button', { name: 'Mover SMT' }));
        await user.click(await screen.findByRole('menuitem', { name: /GRC4 · Beatriz/ }));
        expect(screen.getByRole('dialog')).toHaveTextContent('Mover SMT de GRC3 para GRC4?');
        await user.click(screen.getByRole('button', { name: 'Mover' }));
        await waitFor(() => expect(mover).toHaveBeenCalledWith('c-smt', 'GRC3', 'GRC4'));
        expect(aoMudar).toHaveBeenCalled();
        expect(await screen.findByText(/SMT foi de GRC3 para GRC4/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Desfazer' }));
        await waitFor(() => expect(mover).toHaveBeenLastCalledWith('c-smt', 'GRC4', 'GRC3'));
    });
    it('cancelar não grava; erro aparece', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesView dados={dados} podeMover moverAction={mover} aoMudar={aoMudar} />);
        await user.click(screen.getByRole('button', { name: 'Mover SMT' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Tirar da carteira' }));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(mover).not.toHaveBeenCalled();
        mover.mockResolvedValue({ ok: false, erro: 'Esse cliente mudou de carteira enquanto você olhava. A tela foi atualizada.' });
        await user.click(screen.getByRole('button', { name: 'Mover SMT' }));
        await user.click(await screen.findByRole('menuitem', { name: /GRC4/ }));
        await user.click(screen.getByRole('button', { name: 'Mover' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('mudou de carteira');
        expect(aoMudar).toHaveBeenCalled();
    });
    it('arrastar de "Sem carteira" para um cartão pede a confirmação', () => {
        render(<OrganogramaClientesView dados={dados} podeMover moverAction={mover} aoMudar={aoMudar} />);
        const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
        fireEvent.dragStart(within(screen.getByRole('region', { name: 'Sem carteira' })).getByText('SMC').closest('li')!, { dataTransfer });
        fireEvent.dragOver(cartao(/^Beatriz/), { dataTransfer });
        fireEvent.drop(cartao(/^Beatriz/), { dataTransfer });
        expect(screen.getByRole('dialog')).toHaveTextContent('Mover SMC de Sem carteira para GRC4?');
    });
});
