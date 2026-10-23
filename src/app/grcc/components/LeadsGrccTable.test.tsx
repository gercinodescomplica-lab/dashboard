// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadsGrccTable } from './LeadsGrccTable';
import { LEAD_VAZIO, type LeadGrcc } from '@/lib/grcc/tipos';

const mk = (id: number, over: Partial<LeadGrcc>): LeadGrcc => ({
    ...LEAD_VAZIO, id, criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-20T00:00:00Z', ...over,
});

const leads = [
    mk(1, { cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'No cliente', valor: 260758.68, uf: 'SP', municipio: 'Indaiatuba', previsaoFechamento: '2026-11-10' }),
    mk(2, { cliente: 'ALESP', solicitacao: 'Chatbot', categoria: 'Em tratativas', valor: 0 }),
    mk(3, { cliente: 'Câmara de Osasco', solicitacao: 'Nuvem', categoria: 'Perda', motivoPerda: 'Prazo', valor: 5, uf: 'SP', municipio: 'Osasco' }),
];

describe('LeadsGrccTable', () => {
    it('mostra chips com contagem e filtra por categoria e por pendências', async () => {
        const user = userEvent.setup();
        render(<LeadsGrccTable leads={leads} onAbrir={() => {}} />);
        expect(screen.getAllByRole('row')).toHaveLength(4); // cabeçalho + 3

        await user.click(screen.getByRole('button', { name: /Perda 1/ }));
        expect(screen.getAllByRole('row')).toHaveLength(2);

        await user.click(screen.getByRole('button', { name: /Pendências 1/ }));
        const linhas = screen.getAllByRole('row').slice(1);
        expect(linhas).toHaveLength(1);
        expect(within(linhas[0]).getByText('ALESP')).toBeInTheDocument();
    });

    it('busca por cliente/solicitação/município sem acento', async () => {
        const user = userEvent.setup();
        render(<LeadsGrccTable leads={leads} onAbrir={() => {}} />);
        await user.type(screen.getByPlaceholderText(/Buscar/), 'camara')
        expect(screen.getAllByRole('row')).toHaveLength(2);
    });

    it('clique na linha abre o lead', async () => {
        const user = userEvent.setup();
        const onAbrir = vi.fn();
        render(<LeadsGrccTable leads={leads} onAbrir={onAbrir} />);
        await user.click(screen.getByText('Prefeitura de Indaiatuba'));
        expect(onAbrir).toHaveBeenCalledWith(1);
    });
});
