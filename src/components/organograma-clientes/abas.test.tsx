// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { montarOrganograma } from '@/lib/carteira/organograma-clientes';

vi.mock('@/components/dashboard/OrganizationChartView', () => ({ default: () => <div>organograma de pessoas</div> }));
vi.mock('@/app/settings/carteiraActions', () => ({
    carregarOrganogramaClientesAction: vi.fn().mockResolvedValue(montarOrganograma([{ id: 'GRC3', nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'], clientes: [{ id: 'c', nome: 'Transportes', sigla: 'SMT', ultimoMovimento: null }] }], [])),
}));
import { OrganogramaComAbas } from './abas';

describe('OrganogramaComAbas', () => {
    it('abre em Pessoas e troca para Clientes só leitura', async () => {
        const user = userEvent.setup();
        render(<OrganogramaComAbas lightActive={false} />);
        expect(screen.getByText('organograma de pessoas')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Clientes' }));
        expect(await screen.findByText('SMT')).toBeInTheDocument();
        expect(screen.getByText(/Só leitura/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Mover / })).not.toBeInTheDocument();
    });
});
